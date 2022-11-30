/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 26 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: $webapi

const Base = require('./base')
const path = require('path')
const fse = require('fs-extra')

class $Webapi extends Base {
  async deploy () {
    const that = this
    // const cfgutil = that.node.$env.config.util
    const needDeploy = await super.deploy()
    // console.log(that.name, 'needDeploy=', needDeploy)
    if (!that.isSingle()) {
      throw new Error('集群模式$Webapi部署，尚未实现。')
    }
    const targetDir = '/srv/webapi/config/active'
    const srcDir = `/srv/webapi/config/${that.node.$env.args.target}`

    const cp2Remote = async () => {
      const sftp = await that.node.$term.pvftp()
      const localWebapi = path.join(that.node.$cluster.cacheBase, 'target', 'webapi')
      // console.log('localWebapi=', localWebapi)
      await sftp.cp2Remote(localWebapi, '/srv/webapi')
    }
    const cpAss2Rem = async () => {
      const sftp = await that.node.$term.pvftp()
      const localWebapi = path.join(that.node.$cluster.$uiPrjPath, 'build')
      // console.log('localWebapi=', localWebapi)
      await sftp.cp2Remote(localWebapi, '/srv/webapi/root')
    }
    if (needDeploy) { // 检查上一次编译之后，是否有任意文件被更新。
      await that.node.commands.port('open', [80, 443])
      // // 开始部署单机版$webapi.
      await that.$ensureNodejs()
      await cp2Remote()
      if (that.node.$cluster.bAssInApi()) {
        await cpAss2Rem()
      }
      const cmdStr = `cd /srv/webapi
[[ -f ${targetDir} ]] || ln -s ${srcDir} ${targetDir}      
node start.js --cmd user
node start.js --cmd migrate
pm2 start start.js -i max
pm2 startup --service-name webapi
pm2 save
systemctl restart webapi.service
`
      that.node.addStage('webapi', cmdStr, 'nodejs')
    } else if (that.node.updated.$webapi || that.node.$cluster.bAssInApi()) {
      console.log('webapi或webass已更新，重新发布。')
      await cp2Remote()
      if (that.node.$cluster.bAssInApi()) {
        await cpAss2Rem()
      }
      const cmdStr = `[[ -f ${targetDir} ]] || ln -s ${srcDir} ${targetDir}
pm2 reload start`
      that.node.addStage('webapi', cmdStr, 'nodejs')
    }
  }

  async updCfg () {
    const that = this
    const { _, s } = that.node.$cluster.envs.soa
    const cfgutil = that.node.$cluster.envs.config.util
    const args = that.node.$cluster.envs.args
    // 即使不部署，也需要更新本地local配置，否则会丢失配置。
    const defapiCfg = that.node.$cluster.srvCfg('fastify')
    defapiCfg.conf = defapiCfg.conf || {}
    defapiCfg.conf.bodyLimit = defapiCfg.conf.bodyLimit || 1073741824
    defapiCfg.conf.trustProxy = defapiCfg.conf.trustProxy || true
    // 判断$webapi服务是否需要启用https.
    const domain = _.isString(defapiCfg.domain) ? defapiCfg.domain.split(' ') : []
    domain.push(that.node.pubIp)
    domain.push('127.0.0.1')
    // @TODO: 加入局域网ip??
    const $dnsdef = that.node.$cluster.dnsdef || {}
    if (_.isObject($dnsdef.$webapi)) {
      if ($dnsdef.$webapi.domain) {
        domain.push($dnsdef.$webapi.domain)
      }
      // console.log('$dnsdef=', $dnsdef)
      if ($dnsdef.$webapi.key && $dnsdef.$webapi.cert) {
        const config = cfgutil.path('config', args.target, 'fastify')
        const secret = cfgutil.path('pvdev', 'cluster', args.target, 'secret')
        // console.log('copy config=', config, secret)
        await fse.copy(path.join(secret, $dnsdef.$webapi.key), path.join(config, 'https.key'))
        await fse.copy(path.join(secret, $dnsdef.$webapi.cert), path.join(config, 'https.crt'))
        defapiCfg.conf.http2 = defapiCfg.conf.http2 || true
        defapiCfg.conf.https = defapiCfg.conf.https || { }
      }
    }
    if (domain.length > 0) {
      defapiCfg.domain = s.trim(_.uniq(domain).join(' '))
      // console.log('defapiCfg.domain=', defapiCfg.domain)
    }

    const defSessCfg = that.node.$cluster.srvCfg('session')
    defSessCfg.conf = defSessCfg.conf || {}
    defSessCfg.conf.secret = defSessCfg.conf.secret || _.cryptoRandom({ length: 64 })
  }
}

module.exports = $Webapi
