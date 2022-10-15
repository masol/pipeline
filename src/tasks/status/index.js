
module.exports = function (opts) {
  return async function () {
    const { cluster } = opts
    // console.log('deployer=', deployer)
    const tasks = []
    let hassh = false
    for (const name in deployer.nodes) {
      const node = deployer.nodes[name]
      if (node.type === 'ssh') {
        hassh = true
      }
      tasks.push(deployer.driver.info(node))
    }
    let animation
    if (hassh) {
      const chalkAnimation = (await import('chalk-animation')).default
      const baseStr = '正在通过SSH获取服务器信息(默认超时20秒)，'
      animation = chalkAnimation.rainbow(baseStr + '请稍候...')
    }
    await Promise.all(tasks)
    if (animation) {
      animation.replace('正在通过SSH获取服务状态,请稍候...')
    }

    for (const name in deployer.services) {
      await deployer.driver.allocSrv(deployer.nodes, name, deployer.services[name])
    }

    tasks.length = 0
    for (const name in deployer.nodes) {
      tasks.push(
        deployer.driver.srvStatus(deployer.nodes[name])
      )
    }
    await Promise.all(tasks)

    if (animation) {
      animation.replace('通过SSH获取状态完成。')
      return new Promise((resolve) => {
        setTimeout(() => {
          animation.stop()
          resolve()
        }, 500)
      })
    }

    // console.log('deployer.nodes=', deployer.nodes.local)
  }
}
