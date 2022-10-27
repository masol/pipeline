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

class $Webapi extends Base {
  async deploy () {
    const that = this
    // const cfgutil = that.node.$env.config.util
    const needDeploy = await super.deploy()
    console.log(that.name, 'needDeploy=', needDeploy)
    if (!that.isSingle()) {
      throw new Error('集群模式$Webapi部署，尚未实现。')
    }
    // 开始部署单机版$webapi.
    const term = that.node.$term
    // const { s } = that.node.$env.soa

    const pm2Cmd = await term.exec('which pm2')
    if (!pm2Cmd) {
      const nodejsCmd = await that.$ensureNodejs()
      console.log('nodejsCmd=', nodejsCmd)
      const npmCmd = await term.exec('which npm')
      console.log('npmCmd=', npmCmd)
      // if (!npmCmd) {
      //   await that.node.ensurePkg('npm')
      // }
      await term.exec('sudo mkdir -p /srv/webapi')
      await term.exec(`sudo npm install -g pm2  2>&1 | tee -a ${that.node.logfname}`)
      await term.exec(`sudo useradd -r -d /srv/webapi -s /sbin/nologin webapi 2>&1 | tee -a ${that.node.logfname}`)
    }
    const sftp = await term.pvftp()
    const localWebapi = path.join(that.node.$cluster.cacheBase, 'target', 'webapi')
    console.log('localWebapi=', localWebapi)
    await sftp.cp2Remote(localWebapi, '/srv/webapi')
    await term.exec(`cd /srv/webapi;sudo yarn install 2>&1 | tee -a ${that.node.logfname}`)
    const targetDir = '/srv/webapi/config/active'
    const srcDir = `/srv/webapi/config/${that.node.$env.args.target}`
    await term.exec(`[[ -f $${targetDir} ]] || ln -s ${srcDir} ${targetDir}`).catch(e => '')
  }
}

module.exports = $Webapi
