import * as path from 'path';
import * as joi from 'joi';
import * as dotenv from 'dotenv';
import { SubnetValidator, VpcValidator } from './validators';

interface IConfig {
  AWS: {
    Account: string;
    Region: string;
  };
  Stage: string;
  Ns: string;
  VpcID: string;
  SubnetIDs: string[];
}

dotenv.config({
  path: path.resolve(__dirname, '..', '..', '.env'),
});
console.debug('process.env', process.env);

const schema = joi
  .object({
    AWS_ACCOUNT_ID: joi.number().required(),
    AWS_REGION: joi.string().required(),
    STAGE: joi.string().required(),
    VPC_ID: joi.string().custom(VpcValidator).optional(),
    SUBNET_IDS: joi.string().custom(SubnetValidator).optional(),
    NS: joi.string().required(),
  })
  .with('VPC_ID', 'SUBNET_IDS')
  .unknown();

const { value: envVars, error } = schema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const Config: IConfig = {
  AWS: {
    Account: `${envVars.AWS_ACCOUNT_ID}`,
    Region: envVars.AWS_REGION,
  },
  Stage: envVars.STAGE,
  Ns: `${envVars.NS}${envVars.STAGE}`,
  VpcID: envVars.VPC_ID,
  SubnetIDs: envVars.SUBNET_IDS
    ? envVars.SUBNET_IDS.split(',').filter(Boolean)
    : '',
};
