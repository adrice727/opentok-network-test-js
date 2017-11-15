/**
 * @module NetworkTest
 */

/**
* Define Network Connectivy class
*/

import { connectivityTest, ConnectivityTestResults } from './connectivityTest';
import testQuality from './testQuality';
import {
  IncompleteSessionCredentialsError,
  InvalidOnCompleteCallback,
  InvalidOnUpdateCallback,
  MissingOpenTokInstanceError,
  MissingSessionCredentialsError,
} from './errors';
import { getOr } from '../util';
const analytics  = require('opentok-solutions-logging');


export default class NetworkTest {

  credentials: SessionCredentials;
  environment: OpenTokEnvironment;
  OT: OpenTok;
  otLogging: OTLogging;

  /**
   * Returns an instance of NetworkConnectivity
   */
  constructor(OT: OpenTok, credentials: SessionCredentials, environment: OpenTokEnvironment = 'standard') {
    this.validateOT(OT);
    this.validateCredentials(credentials);
    this.startLoggingEngine(credentials.apiKey, credentials.sessionId);
    this.OT = OT;
    this.credentials = credentials;
    this.environment = environment;
  }

  private validateOT(OT: OpenTok) {
    if (!OT || typeof OT !== 'object' || !OT.initSession) {
      throw new MissingOpenTokInstanceError();
    }
  }

  private validateCredentials(credentials: SessionCredentials) {
    if (!credentials) {
      throw new MissingSessionCredentialsError();
    }
    if (!credentials.apiKey || !credentials.sessionId || !credentials.token) {
      throw new IncompleteSessionCredentialsError();
    }
  }
  private validateCallbacks(
    action: string,
    updateCallback: UpdateCallback<any> | null,
    onComplete?: CompletionCallback<any>) {
    if (updateCallback) {
      if (typeof updateCallback !== 'function' || updateCallback.length !== 1) {
        this.otLogging.logEvent({ action, variation: 'Failure' });
        throw new InvalidOnUpdateCallback();
      }
    }
    if (onComplete) {
      if (typeof onComplete !== 'function' || onComplete.length !== 2) {
        this.otLogging.logEvent({ action, variation: 'Failure' });
        throw new InvalidOnCompleteCallback();
      }
    }
  }

  private startLoggingEngine(apiKey: string, sessionId: string): void {
    this.otLogging = new analytics({
      sessionId,
      partnerId: apiKey,
      source: window.location.href,
      clientVersion: 'js-network-test-1.0.0',
      name: 'opentok-network-test',
      componentId: 'opentok-network-test',
    });
  }

  /**
   * This function runs a test publisher and based on the measured video bitrate,
   * audio bitrate, and the audio packet loss for the published stream, it returns
   * results indicating the recommended supported publisher settings.
   */
  testQuality(
    updateCallback: UpdateCallback<any>,
    completionCallback: CompletionCallback<any>): Promise<any> {
    this.otLogging.logEvent({ action: 'testQuality', variation: 'Attempt' });
    this.validateCallbacks('testQuality', updateCallback, completionCallback);
    return testQuality(
      this.OT, this.credentials, this.environment, this.otLogging, updateCallback, completionCallback);
  }

  /**
   * This method checks to see if the client can connect to TokBox servers required for using OpenTok
   */
  checkConnectivity(
    deviceOptions?: DeviceOptions,
    onComplete?: CompletionCallback<any>): Promise<ConnectivityTestResults> {
    this.otLogging.logEvent({ action: 'checkConnectivity', variation: 'Attempt' });
    this.validateCallbacks('checkConnectivity', null, onComplete);
    return connectivityTest(this.OT, this.credentials, this.environment, this.otLogging, deviceOptions, onComplete);
  }
}
