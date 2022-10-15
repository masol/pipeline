/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License : MIT LICENSE(https://opensource.org/licenses/MIT)              //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 10 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: redis

module.exports.deploy = (opts, compose, srvName, srv, postTask) => {
  const version = srv.version || '7.0.4'
  const port = srv.port || 6379
  compose.services.redis = {
    image: `redis:${version}`,
    container_name: 'pv-redis',
    restart: 'always',
    networks: ['prodvest'],
    labels: { 'com.prodvest.project': 'pv-redis' },
    ports: [`${port}:${port}`],
    volumes: ['pv_redis_data:/data']
  }
  compose.volumes.pv_redis_data = {
    driver: 'local'
  }
  compose.networks.prodvest = compose.networks.prodvest || {}
}
