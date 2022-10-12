/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License : MIT LICENSE(https://opensource.org/licenses/MIT)              //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 11 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: vault

module.exports.deploy = async (opts, compose, srvName, srv, postTask) => {
  const version = srv.version || '1.11.4'
  const port = srv.port || 8200
  compose.services.vault = {
    image: `vault:${version}`,
    container_name: 'pv-vault',
    restart: 'always',
    networks: ['prodvest'],
    labels: { 'com.prodvest.project': 'pv-vault' },
    ports: [`${port}:${port}`],
    cap_add: ['IPC_LOCK'],
    command: [
      'vault',
      'server',
      '-config=/vault/config/vault.json'
    ],
    volumes: [
      'pv_vault_file:/vault/file',
      'pv_vault_logs:/vault/logs',
      'pv_vault_config:/vault/config'
    ]
  }
  compose.volumes.pv_vault_file = {
    driver: 'local'
  }
  compose.volumes.pv_vault_logs = {
    driver: 'local'
  }
  compose.volumes.pv_vault_config = {
    driver: 'local'
  }
  compose.networks.prodvest = compose.networks.prodvest || {}
}
