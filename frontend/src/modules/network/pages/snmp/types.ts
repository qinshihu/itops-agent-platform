export interface SnmpCredential {
  id: string;
  device_id?: string;
  name: string;
  snmp_version: string;
  snmp_port: number;
  snmp_user?: string;
  snmp_auth_protocol?: string;
  snmp_priv_protocol?: string;
  community?: string;
  host?: string;
  created_at: string;
  updated_at: string;
}

export type ApiError = { response?: { data?: { message?: string } }; message?: string };

export type SnmpQueryResult = {
  type: 'system-info';
  data: Record<string, unknown>;
} | {
  type: 'interfaces';
  data: SnmpInterface[];
} | {
  type: 'error';
  data: string;
};

export interface SnmpInterface {
  index: string;
  name: string;
  descr: string;
  operStatus: string;
  speed?: number;
  physAddr?: string;
}

export interface SnmpTrap {
  received_at?: string;
  timestamp?: string;
  sourceIp?: string;
  source?: string;
  severity?: string;
  message?: string;
  description?: string;
  data?: unknown;
  oid?: string;
}

export const VERSIONS = ['v1', 'v2c', 'v3'];
export const AUTH_PROTOCOLS = ['MD5', 'SHA'];
export const PRIV_PROTOCOLS = ['DES', 'AES'];

export interface SnmpCredentialForm {
  name: string;
  host: string;
  port: number;
  version: string;
  community: string;
  user: string;
  authProtocol: string;
  authKey: string;
  privProtocol: string;
  privKey: string;
}

export const INITIAL_FORM: SnmpCredentialForm = {
  name: '',
  host: '',
  port: 161,
  version: 'v2c',
  community: 'public',
  user: '',
  authProtocol: '',
  authKey: '',
  privProtocol: '',
  privKey: '',
};
