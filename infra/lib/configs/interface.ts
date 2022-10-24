export interface IConfig {
  Ns: string;
  Stage: string;
  VPC: {
    VpcID: string;
    SubnetMap: Map<string, string>; // subnetId -> az
  };
  AWS: {
    Account: string;
    Region: string;
  };
}
