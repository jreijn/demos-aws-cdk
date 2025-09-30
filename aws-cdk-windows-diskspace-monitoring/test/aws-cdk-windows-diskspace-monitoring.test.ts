import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as AwsCdkWindowsDiskspaceMonitoring from '../lib/aws-cdk-windows-diskspace-monitoring-stack';

test('SQS Queue and SNS Topic Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new AwsCdkWindowsDiskspaceMonitoring.AwsCdkWindowsDiskspaceMonitoringStack(app, 'MyTestStack');
  // THEN

  const template = Template.fromStack(stack);
  
  template.resourceCountIs('AWS::SNS::Topic', 1);
});
