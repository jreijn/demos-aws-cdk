#!/usr/local/opt/node/bin/node
import * as cdk from 'aws-cdk-lib';
import { AwsCdkWindowsDiskspaceMonitoringStack } from '../lib/aws-cdk-windows-diskspace-monitoring-stack';

const app = new cdk.App();
new AwsCdkWindowsDiskspaceMonitoringStack(app, 'AwsCdkWindowsDiskspaceMonitoringStack', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});
