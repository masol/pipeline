
const fs = require('fs').promises
const path = require('path')

const defSrvs = ['postgres', 'redis', 'elastic']
// 可部署的已知服务
const knowSrvs = ['vault', 'keycloak']

const SrvFname = 'services.json'
const NodeFname = 'nodes.json'
module.exports = function (opts) {
  return async function () {
    opts.soa = await opts.soa
    const { _ } = opts.soa._
    const util = opts.config.util
    // console.log('opts=', opts)
    const targetPath = util.path('pvdev', 'nodes', opts.args.target)
    let DriverCls
    const deployer = {
      nodes: {},
      services: {}
    }
    opts.deployer = deployer
    // 尝试加载nodes定义。
    const nodesFileExist = await fs.access(path.join(targetPath, NodeFname), fs.constants.F_OK)
      .then(() => { return true })
      .catch((e) => { return false })
    if (nodesFileExist) {
      // 读取nodes.json中的内容。 如果发生错误，程序退出。
      const nodeDef = JSON.parse(await fs.readFile(path.join(targetPath, NodeFname), 'utf-8'))
      const driver = (!nodeDef.$driver || nodeDef.$driver === 'auto') ? 'salt' : nodeDef.$driver
      DriverCls = require(`./driver/${driver}`)
      for (const name in nodeDef) {
        if (!name.startsWith('$')) {
          deployer.nodes[name] = nodeDef[name]
        }
      }
    } else {
      DriverCls = require('./driver/salt')
    }
    if (opts.args.target === 'dev' && !_.find(deployer.nodes, o => o.type === 'local')) {
      deployer.nodes.local = {
        type: 'local'
      }
    }
    if (_.isEmpty(deployer.nodes)) {
      throw new TypeError(`目标集群${opts.args.target}未指定任意可计算节点(本地计算机只属于dev集群)。`)
    }
    deployer.driver = new DriverCls(opts)

    // 尝试加载服务列表:
    const srvDefExists = await fs.access(path.join(targetPath, SrvFname), fs.constants.F_OK)
      .then(() => { return true })
      .catch((e) => { return false })
    if (srvDefExists) {
      // 读取nodes.json中的内容。 如果发生错误，程序退出。
      const srvDev = JSON.parse(await fs.readFile(path.join(targetPath, SrvFname), 'utf-8'))

      for (const name in srvDev) {
        if (!name.startsWith('$')) {
          deployer.services[name] = srvDev[name]
        }
      }
    }

    // 检查服务定义是否已经设置，如未设置，设置为default.
    for (let i = 0; i < defSrvs.length; i++) {
      const srvName = defSrvs[i]
      if (!deployer.services[srvName] && !util.isDisabled(srvName)) {
        deployer.services[srvName] = {
          nodes: '$atuo'
        }
      }
    }
    for (let i = 0; i < knowSrvs.length; i++) {
      const srvName = knowSrvs[i]
      if (!deployer.services[srvName] && util.isEnabled(srvName)) {
        deployer.services[srvName] = {
          nodes: '$atuo'
        }
      }
    }

    console.log('deployer=', deployer)
  }
}
