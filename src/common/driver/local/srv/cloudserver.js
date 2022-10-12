/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 11 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: cloudserver

const fs = require('fs').promises
const path = require('path')

async function exist (pathFile) {
  return fs.access(pathFile, fs.constants.F_OK)
    .then(() => { return true })
    .catch((e) => { return false })
}

module.exports.deploy = async (opts, compose, srvName, srv, postTask) => {
  const version = srv.version || 'latest'
  const port = srv.port || 8000
  const cfgutil = opts.config.util
  const s3base = cfgutil.path('config', opts.args.target, 'oss')
  const volumes = [
    'pv_cloudserver_data:/usr/src/app/localData',
    'pv_cloudserver_metadata:/usr/src/app/localMetadata'
  ]
  const authdata = path.join(s3base, 'authdata.json')
  if (await exist(authdata)) {
    volumes.push(`${authdata}:/usr/src/app/conf/authdata.json`)
  }
  const locationConfig = path.join(s3base, 'locationConfig.json')
  if (await exist(locationConfig)) {
    volumes.push(`${locationConfig}:/usr/src/app/locationConfig.json`)
  }
  const config = path.join(s3base, 'config.json')
  if (await exist(config)) {
    volumes.push(`${config}:/usr/src/app/config.json`)
  }
  compose.services.cloudserver = {
    image: `zenko/cloudserver:${version}`,
    container_name: 'pv-cloudserver',
    labels: { 'com.prodvest.project': 'pv-cloudserver' },
    networks: ['prodvest'],
    restart: 'always',
    environment: [
      'REMOTE_MANAGEMENT_DISABLE=1'
    ],
    ports: [`${port}:${port}`],
    volumes
  }
  compose.volumes.pv_cloudserver_data = {
    driver: 'local'
  }
  compose.volumes.pv_cloudserver_metadata = {
    driver: 'local'
  }
  compose.networks.prodvest = compose.networks.prodvest || {}
}
