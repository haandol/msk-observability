import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as msk from '@aws-cdk/aws-msk-alpha';
import { Config } from '../configs/loader';

interface IProps {
  cluster: msk.ICluster;
  brokers: number;
}

interface IMskMetrics {
  activeControllerCount: cw.IMetric;
  offlinePartitionsCount: cw.IMetric;
  underReplicatedPartitions: cw.IMetric[];
  cpuUser: cw.IMetric[];
  diskUsed: cw.IMetric[];
}

interface IAppMetrics {
  maxOffsetLag: Map<string, cw.IMetric>;
}

export class MskDashboard extends Construct {
  constructor(scope: Construct, id: string, props: IProps) {
    super(scope, id);

    const topic = this.newTopic();
    const mskMetrics = this.newMskMetrics(props);
    const appMetrics = this.newAppMetrics(props);

    this.newBrokerAlarms(mskMetrics, topic);
    this.newApplicationAlarms(appMetrics, topic);
    this.newDashboard(mskMetrics, appMetrics);
  }

  newTopic(): sns.ITopic {
    return new sns.Topic(this, `NotificationTopic`, {
      displayName: `${Config.Ns.toLowerCase()}-kafka-notification`,
      topicName: `${Config.Ns.toLowerCase()}-kafka-notification`,
    });
  }

  newMskMetrics(props: IProps): IMskMetrics {
    const activeControllerCount = new cw.Metric({
      namespace: 'AWS/Kafka',
      metricName: 'ActiveControllerCount',
      period: Duration.minutes(1),
      statistic: cw.Statistic.SUM,
      dimensionsMap: {
        'Cluster Name': props.cluster.clusterName,
      },
    });

    const offlinePartitionsCount = new cw.Metric({
      namespace: 'AWS/Kafka',
      metricName: 'OfflinePartitionsCount',
      period: Duration.minutes(1),
      statistic: cw.Statistic.SUM,
      dimensionsMap: {
        'Cluster Name': props.cluster.clusterName,
      },
    });

    const underReplicatedPartitions = [];
    for (let i = 0; i < props.brokers; i++) {
      underReplicatedPartitions.push(
        new cw.Metric({
          namespace: 'AWS/Kafka',
          metricName: 'UnderReplicatedPartitions',
          period: Duration.minutes(1),
          statistic: cw.Statistic.SUM,
          dimensionsMap: {
            'Cluster Name': props.cluster.clusterName,
            'Broker ID': `${i}`,
          },
        })
      );
    }

    const cpuUser = [];
    for (let i = 0; i < props.brokers; i++) {
      cpuUser.push(
        new cw.Metric({
          namespace: 'AWS/Kafka',
          metricName: 'CpuUser',
          period: Duration.minutes(1),
          statistic: cw.Statistic.AVERAGE,
          dimensionsMap: {
            'Cluster Name': props.cluster.clusterName,
            'Broker ID': `${i}`,
          },
        })
      );
    }

    const diskUsed = [];
    for (let i = 0; i < props.brokers; i++) {
      diskUsed.push(
        new cw.Metric({
          namespace: 'AWS/Kafka',
          metricName: 'KafkaDataLogsDiskUsed',
          period: Duration.minutes(1),
          statistic: cw.Statistic.AVERAGE,
          dimensionsMap: {
            'Cluster Name': props.cluster.clusterName,
            'Broker ID': `${i}`,
          },
        })
      );
    }

    return {
      activeControllerCount,
      offlinePartitionsCount,
      underReplicatedPartitions,
      cpuUser,
      diskUsed,
    };
  }

  newAppMetrics(props: IProps): IAppMetrics {
    // TODO: app metrics are should be moved to application infra
    const consumerGroups = ['trip', 'saga', 'car', 'hotel', 'flight'];

    const maxOffsetLag = new Map<string, cw.IMetric>();
    for (let consumerGroup of consumerGroups) {
      maxOffsetLag.set(
        consumerGroup,
        new cw.Metric({
          namespace: 'AWS/Kafka',
          metricName: 'MaxOffsetLag',
          period: Duration.minutes(1),
          statistic: cw.Statistic.MAXIMUM,
          dimensionsMap: {
            'Cluster Name': props.cluster.clusterName,
            'Consumer Group': consumerGroup,
            Topic: `${consumerGroup}-service`,
          },
        })
      );
    }

    return {
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

    // OfflinePartitionsCount
    new cw.Alarm(this, `OfflinePartitionsCountAlarm`, {
      alarmName: `${Config.Ns}KafkaOfflinePartitionsCount`,
      metric: metrics.offlinePartitionsCount,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      threshold: 0,
      evaluationPeriods: 3,
    }).addAlarmAction(new cwActions.SnsAction(topic));

    // UnderReplicatedPartitions
    for (let i = 0; i < metrics.underReplicatedPartitions.length; i++) {
      new cw.Alarm(this, `UnderReplicatedPartitionsAlarm${i}`, {
        alarmName: `${Config.Ns}KafkaUnderReplicatedPartitions${i}`,
        metric: metrics.underReplicatedPartitions[i],
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
        threshold: 0,
        evaluationPeriods: 3,
      }).addAlarmAction(new cwActions.SnsAction(topic));
    }

    // CpuUser
    for (let i = 0; i < metrics.cpuUser.length; i++) {
      new cw.Alarm(this, `CpuUser${i}`, {
        alarmName: `${Config.Ns}KafkaCpuUser${i}`,
        metric: metrics.cpuUser[i],
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
        threshold: 60,
        evaluationPeriods: 3,
      }).addAlarmAction(new cwActions.SnsAction(topic));
    }

    // KafkaDataLogsDiskUsed
    for (let i = 0; i < metrics.diskUsed.length; i++) {
      new cw.Alarm(this, `KafkaDataLogsDiskUsed${i}`, {
        alarmName: `${Config.Ns}KafkaDataLogsDiskUsed${i}`,
        metric: metrics.diskUsed[i],
        comparisonOperator:
          cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        threshold: 85,
        evaluationPeriods: 3,
      }).addAlarmAction(new cwActions.SnsAction(topic));
    }
  }

  newApplicationAlarms(metrics: IAppMetrics, topic: sns.ITopic) {
    // MaxOffsetLag
    // You can specify the metric using the consumer-group or topic name
    metrics.maxOffsetLag.forEach((metric, consumerGroup) => {
      new cw.Alarm(this, `KafkaMaxOffsetLag-${consumerGroup}`, {
        alarmName: `${Config.Ns}KafkaMaxOffsetLag-${consumerGroup}`,
        metric,
        comparisonOperator:
          cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        threshold: 100,
        evaluationPeriods: 3,
      }).addAlarmAction(new cwActions.SnsAction(topic));
    });
  }

  newDashboard(mskMetrics: IMskMetrics, appMetrics: IAppMetrics): void {
    const dashboard = new cw.Dashboard(this, `KafkaDashboard`, {
      dashboardName: `${Config.Ns}KafkaDashboard`,
    });

    const maxOffsetLagMetrics: cw.IMetric[] = [];

    appMetrics.maxOffsetLag.forEach((metric) => {
      maxOffsetLagMetrics.push(metric);
    });

    dashboard.addWidgets(
      new cw.SingleValueWidget({
        title: 'ActiveControllerCount',
        metrics: [mskMetrics.activeControllerCount],
        width: 4,
      }),
      new cw.GraphWidget({
        title: 'OfflinePartitionsCount',
        left: [mskMetrics.offlinePartitionsCount],
        width: 4,
      }),
      new cw.GraphWidget({
        title: 'UnderReplicatedPartitions',
        left: mskMetrics.underReplicatedPartitions,
        width: 16,
      }),

      new cw.GraphWidget({
        title: 'CPU User',
        left: mskMetrics.cpuUser,
        width: 12,
      }),
      new cw.GraphWidget({
        title: 'Disk Used',
        left: mskMetrics.diskUsed,
        width: 12,
      }),

      new cw.GraphWidget({
        title: 'MaxOffsetLag',
        left: maxOffsetLagMetrics,
        width: 12,
      })
    );
  }
}
