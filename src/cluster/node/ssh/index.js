/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License : MIT LICENSE(https://opensource.org/licenses/MIT)              //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 9 Oct 2022 By 李竺唐 of SanPolo.Co.LTD
// File: salt

const Base = require('../base')
const Term = require('./term')

// 记录不同种类的os,可以使用相同的adapter来维护。
const ostypeMapper = {
  darwin: 'freebsd'
}

// 根据操作系统类加载不同的处理库。
function requireOS (ostype) {
  const type = ostypeMapper[ostype] || ostype
  return require(`./os/${type.toLowerCase()}`)
}

class SSH extends Base {
  // 节点维护函数。需要调用对应的issue来执行。
  async ensurePkg (pkgName, version) {
    const that = this
    await requireOS(that.$info.os.type).requireIssue(that).ensurePkg(that, pkgName, version)
  }

  async finish () {
    if (this.$term) {
      const term = this.$term
      delete this.$term
      await term.close()
    }
  }

  /// 当前使用结果，stacksalt中的地址大量不可用，支持mirror需要大量改写，而mirror是必须支持的，否则中国区不可用。
  /// 并且mirror需要贯穿软件维护始终，不仅仅是repo.
  /// 因此废弃stacksalt-formula维护方式，直接使用ssh。在mirror开启后，访问大陆区镜像。
  // clusterTasks的值为{'stageName': true,task: handler} 其中stageName为: afterEnv,beforeApp,afterApp
  // clusterTask修改为cluster的成员，自行修改。
  async deployEnv () {
    const that = this
    that.$term = that.$term || await Term.create(that.$envs, that)
    const { s } = that.$env.soa
    const reqMirror = that.$env.args.mirror
    if (reqMirror) {
      // 检查并修改服务器的mirror设置。
      await requireOS(that.$info.os.type).requireIssue(that).mirror(that)
      // console.log('node=', node)
    }

    const bForce = that.$env.args.force

    // 服务的安装与维护需要串行，防止term上下文依赖。
    for (const srvName in that._srvs) {
      const srv = that._srvs[srvName]
      if (s.startsWith(srvName, '$')) {
        continue
      }
      // 只有服务未就绪，或者开启了force模式时才执行。
      if (!srv.ok || bForce) {
        await srv.deploy().catch(e => {
          throw new Error(`请求部署服务${srvName}时发生错误:${e}`)
        })
      }
    }
  }

  async deployApp () {
  }

  async fetchSrv () {
    const that = this
    const term = that.$term || await Term.create(this.opts, that)
    that.$term = term
    for (const srvName in that._srvs) {
      const srv = that._srvs[srvName]
      if (!srv.status) {
        srv.status = {}
        await requireOS(that.$info.os.type).fetchSrv(srv)
      }
    }
    // throw new Error('salt srvStatus 尚未实现')
  }

  async fetch () {
    const that = this
    if (!that.$info) {
      const { s } = that.$env.soa
      that.$info = {}
      const $info = that.$info
      const term = that.$term || await Term.create(that.$env, that)
      that.$term = term

      // console.log('term=', term)
      // const shell = await term.shell()
      $info.os = {}
      $info.os.type = s.trim(await term.exec('uname -s'))
      // 如果对应type的fetcher不存在，直接抛出异常。
      await requireOS($info.os.type).fetch(that)
    }
  }
}

module.exports = SSH
