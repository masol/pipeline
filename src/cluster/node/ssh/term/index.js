/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 12 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: term

const fs = require('fs').promises
const path = require('path')
const SSH2Promise = require('ssh2-promise')
const sftpUtil = require('./sftp')

const $VaultPrefix = '$vault:'

async function getConf (envOpts, definition) {
  const cfgutil = envOpts.config.util
  const { s } = envOpts.soa
  const secretPath = cfgutil.path('pvdev', 'cluster', envOpts.args.target, 'secret')
  const secretMap = JSON.parse(await fs.readFile(path.join(secretPath, 'secret.json'), 'utf8').catch(e => {
    return '{}'
  }))
  if (!definition.host) {
    throw new Error('ssh节点必须指定host。')
  }
  const conf = {
    host: definition.host,
    port: definition.port || 22,
    username: definition.username || 'root'
  }
  const passwd = (s.startsWith(definition.password, $VaultPrefix)
    ? secretMap[s.strRight(definition.password, ':')]
    : definition.password)
  if (!passwd && !definition.key) {
    throw new Error('ssh节点必须指定密码或证书中的一个')
  }
  if (passwd) {
    conf.password = passwd
  } else {
    conf.privateKey = await fs.readFile(path.join(secretPath, definition.key))
  }
  return conf
}

function pvftp (term, envOpts) {
  let inst = null
  return async function () {
    if (!inst) {
      inst = await term.sftp()
      // 为inst添加几个便捷函数。
      // 1. 递归创建目录。
      inst.ensure = async (path) => {
        return await sftpUtil.ensurePath(inst, path)
      }
      inst.cp2Local = async (remote, local, filter) => {
        await sftpUtil.cp2Local(inst, remote, local, envOpts, filter)
      }
      inst.cp2Remote = async (local, remote, filter) => {
        return await sftpUtil.cp2Remote(inst, local, remote, envOpts, filter)
      }
    }
    return inst
  }
}

module.exports.create = async (envOpts, node) => {
  const definition = node.$definition
  const hop = definition.hop || []
  let conf = await getConf(envOpts, definition)
  if (hop.length > 0) {
    const nodes = envOpts.deployer.nodes
    const hopConf = []
    hopConf.push(conf)
    for (let i = 0; i < hop.length; i++) {
      const hopNode = nodes[hop[i]]
      if (!hopNode) {
        throw new Error(`请求Hop方式连接,但是中间节点${hop[i]}不存在。`)
      }
      const conf = await getConf(envOpts, hopNode)
      hopConf.push(conf)
    }
    conf = hopConf
  }
  const sshInst = new SSH2Promise(conf)
  await sshInst.connect()
  sshInst.pvftp = pvftp(sshInst, envOpts)
  return sshInst
}
