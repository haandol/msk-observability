import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as msk from '@aws-cdk/aws-msk-alpha';
import { Config } from '../configs/loader';

interface IProps {
  cluster: msk.ICluster;
}

interface IMskMetrics {
  activeControllerCount: cw.IMetric;
  underReplicatedPartitions: cw.IMetric;
  offlinePartitionsCount: cw.IMetric;
  cpuUser: cw.IMetric;
  diskUsed: cw.IMetric;
  offsetLag: cw.IMetric;
  maxOffsetLag: cw.IMetric;
}

export class MskDashboard extends Construct {
  constructor(scope: Construct, id: string, props: IProps) {
    super(scope, id);

    const topic = this.newTopic();
    const mskMetrics = this.newMskMetrics(props.cluster);

    this.newBrokerAlarms(mskMetrics, topic);
    this.newApplicationAlarms(mskMetrics, topic);
    this.newDashboard(mskMetrics);
  }

  newTopic(): sns.ITopic {
    return new sns.Topic(this, `NotificationTopic`, {
      displayName: `${Config.Ns.toLowerCase()}-kafka-notification`,
      topicName: `${Config.Ns.toLowerCase()}-kafka-notification`,
    });
  }

  newMskMetrics(cluster: msk.ICluster): IMskMetrics {
    const activeControllerCount = new cw.Metric({
      namespace: 'AWS/Kafka',
      metricName: 'ActiveControllerCount',
      period: Duration.minutes(1),
      statistic: cw.Statistic.SUM,
      dimensionsMap: {
        'Cluster Name': cluster.clusterName,
      },
    });

    const underReplicatedPartitions = new cw.Metric({
      namespace: 'AWS/Kafka',
      metricName: 'UnderReplicatedPartitions',
      period: Duration.minutes(1),
      statistic: cw.Statistic.SUM,
      dimensionsMap: {
        'Cluster Name': cluster.clusterName,
      },
    });

    const offlinePartitionsCount = new cw.Metric({
      namespace: 'AWS/Kafka',
      metricName: 'OfflinePartitionsCount',
      period: Duration.minutes(1),
      statistic: cw.Statistic.SUM,
    });

    const cpuUser = new cw.Metric({
      namespace: 'AWS/Kafka',
      metricName: 'CpuUser',
      period: Duration.minutes(1),
      statistic: cw.Statistic.AVERAGE,
      dimensionsMap: {
        'Cluster Name': cluster.clusterName,
      },
    });

    const diskUsed = new cw.Metric({
      namespace: 'AWS/Kafka',
      metricName: 'KafkaDataLogsDiskUsed',
      period: Duration.minutes(1),
      statistic: cw.Statistic.AVERAGE,
      dimensionsMap: {
        'Cluster Name': cluster.clusterName,
      },
    });

    const offsetLag = new cw.Metric({
      namespace: 'AWS/Kafka',
      metricName: 'OffsetLag',
      period: Duration.minutes(1),
      statistic: cw.Statistic.AVERAGE,
      dimensionsMap: {
        'Cluster Name': cluster.clusterName,
      },
    });

    const maxOffsetLag = new cw.Metric({
      namespace: 'AWS/Kafka',
      metricName: 'MaxOffsetLag',
      period: Duration.minutes(1),
      statistic: cw.Statistic.MAXIMUM,
      dimensionsMap: {
        'Cluster Name': cluster.clusterName,
      },
    });

    return {
      activeControllerCount,
      underReplicatedPartitions,
      offlinePartitionsCount,
      cpuUser,
      diskUsed,
      offsetLag,
      maxOffsetLag,
    };
  }

  newBrokerAlarms(metrics: IMskMetrics, topic: sns.ITopic) {
    // ActiveControllerCount
    new cw.Alarm(this, `ActiveControllerAlarm`, {
      alarmName: `${Config.Ns}KafkaActiveControllerCount`,
      metric: metrics.activeControllerCount,
      comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD,
      threshold: 1,
      evaluationPeriods: 3,
    }).addAlarmAction(new cwActions.SnsAction(topic));

    // UnderReplicatedPartitions
    new cw.Alarm(this, `UnderReplicatedPartitionsAlarm`, {
      alarmName: `${Config.Ns}KafkaUnderReplicatedPartitions`,
      metric: metrics.underReplicatedPartitions,
      threshold: 0,
      evaluationPeriods: 3,
    }).addAlarmAction(new cwActions.SnsAction(topic));

    // OfflinePartitionsCount
    new cw.Alarm(this, `OfflinePartitionsCountAlarm`, {
      alarmName: `${Config.Ns}KafkaOfflinePartitionsCount`,
      metric: metrics.offlinePartitionsCount,
      threshold: 0,
      evaluationPeriods: 3,
    }).addAlarmAction(new cwActions.SnsAction(topic));

    // CpuUser
    new cw.Alarm(this, `CpuUser`, {
      alarmName: `${Config.Ns}KafkaCpuUser`,
      metric: metrics.cpuUser,
      threshold: 60,
      evaluationPeriods: 3,
    }).addAlarmAction(new cwActions.SnsAction(topic));

    // KafkaDataLogsDiskUsed
    new cw.Alarm(this, `KafkaDataLogsDiskUsed`, {
      alarmName: `${Config.Ns}KafkaDataLogsDiskUsed`,
      metric: metrics.diskUsed,
      threshold: 85,
      evaluationPeriods: 3,
    }).addAlarmAction(new cwActions.SnsAction(topic));
  }

  newApplicationAlarms(metrics: IMskMetrics, topic: sns.ITopic) {
    // MaxOffsetLag
    // You can specify the metric using the consumer-group or topic name
    new cw.Alarm(this, `KafkaMaxOffsetLag`, {
      alarmName: `${Config.Ns}KafkaMaxOffsetLag`,
      metric: metrics.maxOffsetLag,
      threshold: 100,
      evaluationPeriods: 3,
    }).addAlarmAction(new cwActions.SnsAction(topic));

    // OffsetLag
    // You can specify the metric using the consumer-group or topic name
    new cw.Alarm(this, `KafkaOffsetLag`, {
      alarmName: `${Config.Ns}KafkaOffsetLag`,
      metric: metrics.offsetLag,
      threshold: 100,
      evaluationPeriods: 3,
    }).addAlarmAction(new cwActions.SnsAction(topic));
  }

  newDashboard(metrics: IMskMetrics): void {
    const dashboard = new cw.Dashboard(this, `KafkaDashboard`, {
      dashboardName: `${Config.Ns}KafkaDashboard`,
    });

    dashboard.addWidgets(
      new cw.SingleValueWidget({
        title: 'ActiveControllerCount',
        metrics: [metrics.activeControllerCount],
        width: 8,
      }),
      new cw.GraphWidget({
        title: 'UnderReplicatedPartitions',
        left: [metrics.underReplicatedPartitions],
        width: 8,
      }),
      new cw.GraphWidget({
        title: 'OfflinePartitionsCount',
        left: [metrics.offlinePartitionsCount],
        width: 8,
      }),
      new cw.GraphWidget({
        title: 'CPU User',
        left: [metrics.cpuUser],
        width: 12,
      }),
      new cw.GraphWidget({
        title: 'Disk Used',
        left: [metrics.diskUsed],
        width: 12,
      }),
      new cw.GraphWidget({
        title: 'MaxOffsetLag',
        left: [metrics.maxOffsetLag],
        width: 12,
      }),
      new cw.GraphWidget({
        title: 'OffsetLag',
        left: [metrics.offsetLag],
        width: 12,
      })
    );
  }
}
