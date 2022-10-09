
// let chalkInstance = null
// async function getChalk () {
//   if (!chalkInstance) {
//     chalkInstance = (await import('chalk')).default
//   }
//   return chalkInstance
// }

let chalkTemplate = null
async function getTpl () {
  if (!chalkTemplate) {
    chalkTemplate = (await import('chalk-template')).default
  }
  return chalkTemplate
}

let fileSizeInst = null
async function getFSizer () {
  if (!fileSizeInst) {
    fileSizeInst = (await import('filesize')).default
  }
  return fileSizeInst
}

// const chalkAnimation = null
// async function getAnim () {
//   if (!chalkAnimation) {
//     chalkAnimation = (await import('chalk-animation')).default
//   }
//   return chalkAnimation
// }

const logger = require('fancy-log')
// 下两句将使得自定义报告结果与默认gulp保持一致。
// const util = require('util')
// util.inspect.styles.date = 'gray'

module.exports = function (opts) {
  return async function () {
    // const chalk = await getChalk()
    const fsizer = await getFSizer()
    const sizer = fsizer.partial({ base: 2, standard: 'jedec' })
    const tpl = await getTpl()
    const { _ } = opts.soa

    logger(tpl`{green ======目标集群{red.bold ${opts.args.target}}共包含{red.bold ${_.keys(opts.deployer.nodes).length}}台计算机:{yellow.bold 状态报告}=====}`)

    let canDeploy = false
    // 开始构建table数据。
    const baseReporter = []
    const netReporter = []
    const srvReporter = []
    for (const name in opts.deployer.nodes) {
      const node = opts.deployer.nodes[name]
      const $info = node.$info
      const family = $info.cpus.length > 0 ? $info.cpus[0].model : '未知'
      baseReporter.push({
        节点名称: name,
        cpu型号: family,
        cpu架构: $info.arch,
        总线程数: $info.cpus.length,
        操作系统: $info.os.platform,
        版本号: $info.os.release,
        总内存: sizer($info.mem.total),
        未用内存: sizer($info.mem.free),
        接口数: _.keys($info.net).length
      })
      const net = {
        节点名称: name
      }
      const srv = {
        节点名称: name
      }

      let i = 0
      for (const ifname in $info.net) {
        net[`接口${i}`] = ifname
        net[`接口${i}地址`] = $info.net[ifname]
        for (const srvName in node.srvs) {
          const srvInfo = node.srvs[srvName].status || {}
          // console.log('srvInfo=', srvInfo)
          srv[srvName] = srvInfo.ok
          if (!srvInfo.ok) {
            canDeploy = true
          }
        }
        i++
      }

      netReporter.push(net)
      srvReporter.push(srv)
    }

    logger(tpl`{green ~~~{yellow.bold 节点基础信息}~~~}`)
    console.table(baseReporter)
    logger(tpl`{green ~~~{yellow.bold 节点网络信息}~~~}`)
    console.table(netReporter)
    logger(tpl`{green ~~~{yellow.bold 节点服务信息}~~~}`)
    console.table(srvReporter)
    if (canDeploy) {
      logger(tpl`{red 有节点服务未就绪,需要执行{gray gulp deploy}来部署。}`)
    } else {
      logger(tpl`{green 环境就绪!}`)
    }
  }
}
