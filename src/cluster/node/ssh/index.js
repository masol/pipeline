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

// 根据操作系统类习惯你加载不同的处理库。
function requireOS (ostype) {
  const type = ostypeMapper[ostype] || ostype
  return require(`./os/${type.toLowerCase()}`)
}

class SSH extends Base {
  async finish () {
    if (this.$term) {
      const term = this.$term
      delete this.$term
      await term.close()
    }
  }

  async deployEnv (clusterTasks) {
    const that = this
    that.$term = that.$term || await Term.create(that.$envs, that)
    await requireOS(that.$info.os.type).deployEnv(that, clusterTasks)
  }

  async deployApp () {
  }

  async fetchSrv () {
    const that = this
    const { _ } = that.$env.soa
    const term = that.$term || await Term.create(this.opts, that)
    that.$term = term
    _.forEach(that._srvs, async (srv) => {
      if (!srv.status) {
        srv.status = {}
        await requireOS(that.$info.os.type).fetchSrv(srv)
      }
    })
    // throw new Error('sal srvStatus 尚未实现')
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
