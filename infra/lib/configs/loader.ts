import * as path from 'path';
import * as joi from 'joi';
import * as dotenv from 'dotenv';
import { VpcValidator } from './validators';

interface IConfig {
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

dotenv.config({
  path: path.resolve(__dirname, '..', '..', '.env'),
});
console.debug('process.env', process.env);

const schema = joi
  .object({
    NS: joi.string().required(),
    STAGE: joi.string().required(),
    VPC_ID: joi.string().custom(VpcValidator).optional(),
    SUBNET_INFO: joi.string().optional(),
    AWS_ACCOUNT_ID: joi.number().required(),
    AWS_REGION: joi.string().required(),
  })
  .with('VPC_ID', 'SUBNET_INFO')
  .unknown();

const { value: envVars, error } = schema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const buildSubnetMap = (subnetInfo: string): Map<string, string> => {
  const subnetMap = new Map<string, string>();
  if (!subnetInfo) {
    return subnetMap;
  }

  const infoArr = subnetInfo.split(',').filter(Boolean);
  if (infoArr.length % 2 !== 0) {
    throw new Error(
      `Invalid subnet info. SUBNET_INFO value should go like, "subnet-123,az-1,subnet-234,az-2": ${subnetInfo}`
    );
  }

  for (let i = 0; i < infoArr.length; i += 2) {
    const subnetId = infoArr[i];
    const az = infoArr[i + 1];
    if (!subnetId.startsWith('subnet-')) {
      throw new Error(`Invalid subnet ID: ${subnetId}`);
    }
    subnetMap.set(subnetId, az);
  }

  return subnetMap;
};

export const Config: IConfig = {
  Ns: `${envVars.NS}${envVars.STAGE}`,
  Stage: envVars.STAGE,
  VPC: {
    VpcID: envVars.VPC_ID,
    SubnetMap: buildSubnetMap(envVars.SUBNET_INFO),
  },
  AWS: {
    Account: `${envVars.AWS_ACCOUNT_ID}`,
    Region: envVars.AWS_REGION,
  },
};
