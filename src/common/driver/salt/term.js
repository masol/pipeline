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

const $VaultPrefix = '$vault:'

async function getConf (envOpts, node) {
  const cfgutil = envOpts.config.util
  const { s } = envOpts.soa
  const secretPath = cfgutil.path('pvdev', 'nodes', envOpts.args.target, 'secret')
  const secretMap = JSON.parse(await fs.readFile(path.join(secretPath, 'secret.json'), 'utf8').catch(e => {
    return '{}'
  }))
  if (!node.host) {
    throw new Error('ssh节点必须指定host。')
  }
  const conf = {
    host: node.host,
    port: node.port || 22,
    username: node.username || 'root'
  }
  const passwd = (s.startsWith(node.password, $VaultPrefix)
    ? secretMap[s.strRight(node.password, ':')]
    : node.password)
  if (!passwd && !node.key) {
    throw new Error('ssh节点必须指定密码或证书中的一个')
  }
  if (passwd) {
    conf.password = passwd
  } else {
    conf.privateKey = await fs.readFile(path.join(secretPath, node.key))
  }
  return conf
}

module.exports.create = async (envOpts, node) => {
  const hop = node.hop || []
  let conf = await getConf(envOpts, node)
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
  const conn = new SSH2Promise(conf)
  const ret = await conn.connect()
  return ret
}
