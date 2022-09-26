#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/stacks/vpc-stack';
import { MskStack } from '../lib/stacks/msk-stack';
import { Config } from '../lib/configs/loader';

const app = new cdk.App();

console.log(Config);

const vpcStack = new VpcStack(app, `${Config.Ns}VpcStack`);
const mskStack = new MskStack(app, `${Config.Ns}MskStack`, {
  vpc: vpcStack.vpc,
});
mskStack.addDependency(vpcStack);

const tags = cdk.Tags.of(app);
tags.add(`namespace`, Config.Ns);

app.synth();
