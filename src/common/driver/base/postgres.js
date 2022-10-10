/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License : MIT LICENSE(https://opensource.org/licenses/MIT)              //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 10 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: postgres

const fs = require('fs').promises

module.exports.deploy = async (opts, compose, srvName, srv, postTask) => {
  const version = srv.version || '14.5.0'
  const username = srv.username || 'app'
  const database = srv.database || 'app'
  const port = srv.port || 5432
  const cfgutil = opts.config.util
  const pgpwd = cfgutil.path('config', opts.args.target, 'postgres', 'app.passwd')
  const passwd = await fs.readFile(pgpwd, 'utf-8').catch(async e => {
    if (e.code === 'ENOENT') {
      const { _ } = opts.soa
      const newpwd = _.cryptoRandom({ length: 16 })
      await fs.writeFile(pgpwd, newpwd)
      return newpwd
    }
    throw e
  })
  compose.services.postgresql = {
    image: `bitnami/postgresql:${version}`,
    container_name: 'pv-postgres',
    labels: { 'com.prodvest.project': 'pv-postgres' },
    networks: ['prodvest'],
    restart: 'always',
    environment: [
      `POSTGRESQL_USERNAME=${username}`,
      `POSTGRESQL_DATABASE=${database}`,
      `POSTGRESQL_PASSWORD=${passwd}`
    ],
    ports: [`${port}:${port}`],
    volumes: ['pv_postgresql_data:/bitnami/postgresql']
  }
  compose.volumes.pv_postgresql_data = {
    driver: 'local'
  }
  compose.networks.prodvest = compose.networks.prodvest || {}
}
