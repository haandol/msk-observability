import { Stack, StackProps, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as msk from '@aws-cdk/aws-msk-alpha';
import { Config } from '../configs/loader';

interface IProps extends StackProps {
  vpc: ec2.IVpc;
  securytyGroup: ec2.ISecurityGroup;
}

export class MskStack extends Stack {
  public readonly cluster: msk.ICluster;

  constructor(scope: Construct, id: string, props: IProps) {
    super(scope, id, props);

    this.cluster = new msk.Cluster(this, `MskCluster`, {
      clusterName: `${Config.Ns.toLowerCase()}`,
      kafkaVersion: msk.KafkaVersion.V2_8_1,
      numberOfBrokerNodes: 2,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.securytyGroup],
      encryptionInTransit: {
        clientBroker: msk.ClientBrokerEncryption.TLS_PLAINTEXT,
        enableInCluster: true,
      },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.SMALL
      ),
      ebsStorageInfo: { volumeSize: 100 },
      monitoring: {
        clusterMonitoringLevel:
          msk.ClusterMonitoringLevel.PER_TOPIC_PER_PARTITION,
        enablePrometheusJmxExporter: true,
        enablePrometheusNodeExporter: true,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.cluster.connections.allowInternally(ec2.Port.allTraffic());

    new CfnOutput(this, `${Config.Ns}ClusterArn`, {
      value: this.cluster.clusterArn,
    });
  }
}
