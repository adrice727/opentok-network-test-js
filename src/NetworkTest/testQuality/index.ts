/**
 * @module Test/Publishing
 * @preferred
 *
 * Defines the methods required for the Publishing Test Flow
 */

/**
 * Publishing Test Flow
 */

const config = require('./defaultConfig');
import * as Promise from 'promise';
import * as e from '../../errors/index';
const { generateRetValFromOptions } = require('./helpers/generateRetValFromOptions.js');
import SubscriberMOS from './helpers/SubscriberMOS';

let updateCallback: UpdateCallback<any> | undefined;
let ot:OpenTok;
let session: OT.Session;
let credentials: SessionCredentials;
let otLogging: OTLogging;
const testContainerDiv = document.createElement('div');

const connectToSession = () => {
  return new Promise((resolve, reject) => {
    if (session.connection) {
      resolve(session);
    }
    session.connect(credentials.token, (error) => {
      if (error) {
        reject(error);
      }
      resolve(session);
    });
  });
};

const subscribeToTestStream = () => {
  return new Promise((resolve, reject) => {
    connectToSession().then(() => {
      const publisher = ot.initPublisher(testContainerDiv, {}, (error) => {
        if (error) {
          reject(error);
        }
        session.publish(publisher, (error) => {
          if (error) {
            reject(error);
            return;
          }
        });
      });
      publisher.on('streamCreated', (event: StreamCreatedEvent) => {
        const subProps = {
          testNetwork: true,
        };
        const subscriber = session.subscribe(event.stream, testContainerDiv, subProps, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve(subscriber);
          }
        });
      });
    }).
    catch((error) => {
      reject(error);
    });
  });
};

const getFinalRetVal = (results: any): TestQualityResults => {
  return {
    mos: results.mosScore,
    audio: {
      bandwidth: results.bandwidth.audio,
    },
    video: {
      bandwidth: results.bandwidth.video,
    }
  };
};

const checkSubscriberQuality = () => {
  let mosEstimatorTimeoutId: number;
  let getStatsListenerIntervalId: number;

  return new Promise((resolve, reject) => {
    subscribeToTestStream().then((subscriber) => {
      const retVal = generateRetValFromOptions({
        subscriber,
        apiKey: credentials.apiKey,
        sessionId: credentials.sessionId,
        token: credentials.token,
      });
      if (!retVal.subscriber) {
        otLogging.logEvent({ action: 'testQuality', variation: 'Failure' });
        reject(new e.FailedCheckSubscriberQualityMissingSubscriberError());
      } else {
        try {
          SubscriberMOS(
            {
              subscriber: retVal.subscriber,
              getStatsListener: (error: string, stats: OT.SubscriberStats) => {
                updateCallback && updateCallback(stats);
              },
            },
            (qualityScore: number, bandwidth: number) => {
              clearTimeout(mosEstimatorTimeoutId);
              retVal.mosScore = qualityScore;
              retVal.bandwidth = bandwidth;
              session.disconnect();
              otLogging.logEvent({ action: 'testQuality', variation: 'Success' });
              resolve(getFinalRetVal(retVal));
            });
          mosEstimatorTimeoutId = setTimeout(
            () => {
              clearInterval(getStatsListenerIntervalId);
              retVal.mosScore = retVal.mosEstimator.qualityScore();
              retVal.bandwidth = retVal.mosEstimator.bandwidth;
              session.disconnect();
              otLogging.logEvent({ action: 'testQuality', variation: 'Success' });
              resolve(getFinalRetVal(retVal));
            }, 
            config.getStatsVideoAndAudioTestDuration);
        } catch (exception) {
          /* TBD:
          if (exception instanceof e.PrecallError) {
            reject(exception);
          } else {
          */
          otLogging.logEvent({ action: 'testQuality', variation: 'Failure' });
          reject(new e.FailedCheckSubscriberQualityGetStatsError());
        }
      }
    });
  });
};

/**
 * This method checks to see if the client can publish to an OpenTok session.
 */
const testQuality = (
  otObj: OpenTok,
  credentialsObj: SessionCredentials,
  environment: OpenTokEnvironment,
  otLoggingObj: OTLogging,
  onUpdate?: UpdateCallback<any>,
  onComplete?: CompletionCallback<any>): Promise<any> =>
  new Promise((resolve, reject) => {
    ot = otObj;
    credentials = credentialsObj;
    session = ot.initSession(credentials.apiKey, credentials.sessionId);
    otLogging = otLoggingObj;
    updateCallback = onUpdate;
    checkSubscriberQuality()
    // .then(cleanup)
      .then((result) => {
        resolve(result);
      });
  });

export default testQuality;
