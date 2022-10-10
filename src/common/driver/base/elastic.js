/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License : MIT LICENSE(https://opensource.org/licenses/MIT)              //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 10 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: elastic

const baseUtil = require('./utils')
const pty = require('node-pty')
const fs = require('fs').promises

async function resetPwd (dockerPath) {
  const chalkAnimation = (await import('chalk-animation')).default
  return new Promise((resolve, reject) => {
    const baseStr = '正在重置elasticsearch的登录密码，'
    const animation = chalkAnimation.rainbow(baseStr + '请稍候...')
    const dockerProc = pty.spawn(dockerPath,
      [
        'exec',
        '-it',
        'pv-elastic',
        '/usr/share/elasticsearch/bin/elasticsearch-reset-password',
        '-u',
        'elastic',
        '-f',
        '-s',
        '-a'
      ],
      {
        name: 'prodvest faked pty',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME,
        env: process.env
      })

    let nextIsPwd = false
    let pwd
    dockerProc.onData((data) => {
      const str = data.toString('utf8')
      if (nextIsPwd) {
        pwd = str
      }
      // console.log('recieved data:', data.toString('utf8'))
      if (str.indexOf('Please confirm that you would like to continue') >= 0) {
        nextIsPwd = true
        dockerProc.write('y\n')
      }
    })
    dockerProc.onExit((code) => {
      const isSuc = (code && code.exitCode === 0 && pwd)
      animation.replace(baseStr + (isSuc ? '成功' : '失败！'))
      setTimeout(() => {
        animation.stop()
        if (isSuc) {
          resolve(pwd)
        } else {
          reject(code)
        }
      }, 50)
    })
  })
}

module.exports.deploy = async (opts, compose, srvName, srv, postTask) => {
  const version = srv.version || '8.4.3'
  const port = srv.port || 9200
  const manPort = srv.manport || 9300
  compose.services.elastic = {
    image: `elasticsearch:${version}`,
    container_name: 'pv-elastic',
    restart: 'always',
    networks: ['prodvest'],
    labels: { 'com.prodvest.project': 'pv-elastic' },
    ports: [
      `${port}:${port}`,
      `${manPort}:${manPort}`
    ],
    environment: [
      'discovery.type=single-node',
      'ES_JAVA_OPTS=-Xms512m -Xmx512m'
    ],
    volumes: [
      'pv_elastic_data:/usr/share/elasticsearch/data',
      'pv_elastic_log:/usr/share/elasticsearch/logs'
    ]
  }
  compose.volumes.pv_elastic_data = {
    driver: 'local'
  }
  compose.volumes.pv_elastic_log = {
    driver: 'local'
  }
  compose.networks.prodvest = compose.networks.prodvest || {}
  postTask.push(async () => {
    // const { shelljs } = opts.soa
    const { shelljs } = opts.soa
    const dockerPath = baseUtil.getDockerBin(shelljs)
    const cfgutil = opts.config.util
    const pwd = await resetPwd(dockerPath)
    // console.log('pwd=', pwd)
    await fs.writeFile(cfgutil.path('config', opts.args.target, 'elastic', 'passwd'), pwd)

    const elastiCA = cfgutil.path('config', opts.args.target, 'elastic', 'http_ca.crt')
    const cpResult = shelljs.exec(`"${dockerPath}" cp pv-elastic:/usr/share/elasticsearch/config/certs/http_ca.crt "${elastiCA}"`, { silent: true })
    if (cpResult.code !== 0) {
      throw new Error('无法获取elasticsearch的证书')
    }
  })
}
