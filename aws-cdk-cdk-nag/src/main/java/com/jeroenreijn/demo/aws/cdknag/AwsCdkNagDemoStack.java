package com.jeroenreijn.demo.aws.cdknag;

import software.amazon.awscdk.Duration;
import software.amazon.awscdk.services.lambda.Code;
import software.amazon.awscdk.services.lambda.Function;
import software.amazon.awscdk.services.lambda.Runtime;
import software.amazon.awscdk.services.lambda.eventsources.SqsEventSource;
import software.amazon.awscdk.services.sqs.Queue;
import software.constructs.Construct;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;

import java.util.List;


public class AwsCdkNagDemoStack extends Stack {
    public AwsCdkNagDemoStack(final Construct scope, final String id) {
        this(scope, id, null);
    }

    public AwsCdkNagDemoStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        final Queue queue = Queue.Builder.create(this, "demo-queue")
                 .visibilityTimeout(Duration.seconds(300))
                 .build();

        Function function = Function.Builder.create(this,"demo-function")
                .handler("com.jeroenreijn.demo.aws.cdknag.FunctionHandler")
                .code(Code.fromAsset("function.jar"))
                .runtime(Runtime.JAVA_11)
                .events(List.of(SqsEventSource.Builder.create(queue).build()))
                .build();

        queue.grantConsumeMessages(function);
    }
}
