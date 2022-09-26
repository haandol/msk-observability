import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Config } from '../configs/loader';

export class VpcStack extends Stack {
  public readonly vpc: ec2.IVpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // import or create vpc
    if (Config.VpcID) {
      this.vpc = ec2.Vpc.fromLookup(this, `Vpc`, {
        vpcId: Config.VpcID,
      });
    } else {
      this.vpc = new ec2.Vpc(this, `Vpc`, { maxAzs: 2 });
    }
  }
}
