const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const autoeat = require('mineflayer-auto-eat').default
const GoalBlock = goals.GoalBlock
const botName = 'mineBot' //机器人的名字
const version = '1.19'
const bot = mineflayer.createBot({
    username: botName,
    host: 'localhost',
    port: 25565,
    version: version
})
const bossName = 'pain1929' //主人名字
var chestPos = [255, 255, 255]   //被机器人存储矿物的箱子坐标

var findName = 'iron_ore' //目标矿物
var submitName = 'iron_ore' //需要提交的物品（diamond_ore -> diamond）
var max_ore = 20           //最大矿物数量（达到上限后自动存储到箱子中）


var cantFoundAny = false
var playerStop = false
var need_restart = false
bot.loadPlugin(pathfinder)
bot.loadPlugin(autoeat)
/**
 *  指令帮助：
 *      run -    运行机器人
 *      stop -   暂停机器人
 *      chest -  主动提交矿物到坐标箱子
 *      drop -   机器人丢弃所有物品
 *      back -   机器人返回到你当先的位置
 *      chatbag -手动检查机器人背包 
 *      set -    设置游戏参数
 *               - chest [x] [y] [z] 设置存储箱位置（坐标）
 *               - findName '矿物名' 设置目标矿物（英文）
 *               - submitName '矿物名' 设置提交矿物（英文）
 *               - max [number] 设置最大挖矿数量（数字）
 *      pos -    显示机器人的位置
 *      autoset -自动设置挖矿目标 例如： autoset '钻石'（中文）
 *      armor  - 机器人装备盔甲 
 *      query  - 查询矿物名称  
 * 
 *  操作指南：
 *     1.机器人需至少需要1把稿子（木稿除外）至少需要5块圆石
 *     2.机器人需要一个箱子坐标作为 ‘家’ 手动设置箱子位置： set chest [x] [y] [z] (若输入 set cheston 则默认为当前位置)
 *     3.使用前请修改 bossName chestPos 属性
 *     4.请修改ip/端口 （本地局域网 ip：127.0.0.1/服务器ip <-----> 端口(port): 开启局域网后在客户端显示/服务器端口号）
 *     5.version(版本号)：游戏客户端版本/服务端版本
 * 
 */



bot.once('spawn', function () {
    console.log('bot 已进入游戏')


    //寻找钻石
    async function findDiamond() {
        const mcData = require('minecraft-data')(bot.version)

        const blocks = bot.findBlocks({
            matching: mcData.blocksByName[findName].id,
            maxDistance: 120,
            count: 6
        })

        if (blocks.length == 0) {
            cantFoundAny = true
            return
        }

        try {
            for (var i = 0; i < blocks.length; i++) {
                var block = blocks[i];
                console.log('find' + i + ' - 路径开始('+findName+')')
                await bot.pathfinder.goto(new GoalBlock(block.x, block.y, block.z))
                console.log('find' + i + ' - 路径结束')
                console.log(' ')

            }
            await chatBag()
        } catch (e) { }

    }
    //返回到玩家当前的位置
    async function backToPlayer() {
        playerStop = true
        const mcData = require('minecraft-data')(bot.version)
        const player = bot.players[bossName].entity
        if (!player) {
            console.log('找不到主人！')
            return
        }
        try {
            console.log('back - 路径开始')
            await bot.pathfinder.goto(new GoalBlock(player.position.x, player.position.y, player.position.z))
            console.log('back - 路径结束')

        } catch (e) {

        }

    }
    //返回箱子位置并将钻石放入
    async function putInChest() {
        need_restart = false
        playerStop = true
        const mcData = require('minecraft-data')(bot.version)
        const goal = new GoalBlock(chestPos[0], chestPos[1], chestPos[2])

        console.log('chest - 路径开始')
        try{await bot.pathfinder.goto(goal)}catch(e){}  
        console.log('chest - 路径结束')
        const block = await bot.findBlock({
            matching: mcData.blocksByName['chest'].id,
            maxDistance: 10
        })
        if (!block) {
            console.log('chest - 未找到任何箱子')
            return
        }

        bot.waitForTicks(25)
        const items = bot.inventory.slots
        const chest = await bot.openChest(block)
        for (var i = 0; i < items.length; i++) {
            const item = items[i]
            if (item != null && (item.name == submitName)) {
                await chest.deposit(item.type, null, item.count)
            }
        }
        console.log('chest - 矿物已提交')
        bot.waitForTicks(50)
    }
    //丢掉全部物品
    async function dropItem() {
        const items = bot.inventory.slots
        for (var i = 0; i < items.length; i++) {
            var item = items[i]
            if (item != null) {
                await bot.tossStack(bot.inventory.slots[item.slot])
            }
        }
    }

    async function chatBag() {
        const items = bot.inventory.slots
        var cobblestone_slot = 0     //圆石最多的一槽
        var max_cobblestone = 0
        var durability = 0          //最后一个镐已经使用的耐久（可能是脏数据 当pickaxe_count = 1 时 准确）
        var pickaxe_count = 0       //当前镐的数量
        var lastPickaxe = null      //最后一个镐的名字 可能是脏数据 当pickaxe_count = 1 时 准确
        var ore_count = 0
        var garbage_count = 0
        //白名单（不会被丢弃的物品）
        const whiteList = {
            diamond: 1,
            diamond_ore: 1,
            diamond_pickaxe: 1,
            iron_pickaxe: 1,
            stone_pickaxe: 1,
            diamond_sword: 1,
            iron_sword: 1,
            stone_sword: 1,
            diamond_shovel: 1,
            iron_shovel: 1,
            stone_shovel: 1,
            iron_ore: 1,
            raw_iron: 1,
            raw_gold: 1,
            coal: 1,
            lapis_lazuli: 1,
            ancient_debris: 1,
            emerald: 1
        }
        //遍历背包
        for (var i = 0; i < items.length; i++) {
            const item = items[i]
            if (item != null && item.name == 'cobblestone') {
                if (item.count == 64) {
                    cobblestone_slot = item.slot
                } else {
                    if (item.count > max_cobblestone) {
                        max_cobblestone = item.count
                        cobblestone_slot = item.slot
                    }
                }
            }
            if (item != null && (item.name == 'diamond_pickaxe' || item.name == 'iron_pickaxe' || item.name == 'stone_pickaxe')) {
                pickaxe_count++
                lastPickaxe = item.name
                durability = item.durabilityUsed
            }
            if (item != null && item.name == submitName) {
                ore_count += item.count
            }
            if (item != null && whiteList[item.name] != 1) {
                garbage_count += item.count
            }

        }
        console.log('剩余镐数量：' + pickaxe_count + ' 已挖到矿物：' + ore_count + '/' + max_ore + ' 垃圾数量：' + garbage_count)
        //如果只剩下最后一把镐
        if (pickaxe_count == 1) {
            if ((lastPickaxe == 'diamond_pickaxe' && durability >= 1300) || (lastPickaxe == 'iron_pickaxe' && durability >= 100)) {
                console.log('背包剩余镐不足 正在返航!')
                await putInChest()
            }
        }
        //背包钻石数量以满足
        if (ore_count >= max_ore) {
            await putInChest()
            need_restart = true
        }
        //丢弃物品
        if (garbage_count <= 1150) { return }
        for (var i = 0; i < items.length; i++) {
            const item = items[i]
            if (item != null) {
                if (whiteList[item.name] != 1 && (item.slot != cobblestone_slot)) {
                    await bot.tossStack(bot.inventory.slots[item.slot])
                }
            }

        }
    }
    //机器人自保
    async function self_defense() {
        const filter = e =>e.mobType!='Item' && e.type != "player" && e.type != 'orb' &&
         e.position.distanceTo(bot.entity.position) < 5       
        const entity = bot.nearestEntity(filter)
        if (!entity) return
        const sword = bot.inventory.items().find(item => item.name.includes('sword'))
        if (sword) {
            bot.equip(sword)
        }
        try{
            bot.attack(entity)
        }catch(e){}
        
    }

    //佩戴装备
    async function takeArmor() {
        const chestplate = bot.inventory.items().find(item => item.name.includes('chestplate'))
        const helmet = bot.inventory.items().find(item => item.name.includes('helmet'))
        const leggings = bot.inventory.items().find(item => item.name.includes('leggings'))
        const boots = bot.inventory.items().find(item => item.name.includes('boots'))
        if (chestplate) await bot.equip(chestplate, 'torso')
        if (helmet) await bot.equip(helmet, 'head')
        if (leggings) await bot.equip(leggings, 'legs')
        if (boots) await bot.equip(boots, 'feet')
    }
    //启动机器人

    async function run() {
        console.log('已启动！')
        need_restart = false
        cantFoundAny = false
        playerStop = false
        while (true) {
            if (cantFoundAny || playerStop) break
            await findDiamond()
        }
        if (cantFoundAny) {
            const x = (bot.entity.position.x)
            const y = (bot.entity.position.y)
            const z = (bot.entity.position.z) + 20
            try {
                console.log('transfer - 路径开始')
                await bot.pathfinder.goto(new GoalBlock(x, y, z))
                console.log('transfer - 路径结束')
                need_restart = true
            } catch (e) { }
        }
        console.log('当前run函数已结束')
    }

    bot.on('chat', async function (username, message) {
        const mcData = require('minecraft-data')(bot.version)
        if (username != bossName && username != botName) return
        var mess = message.split(' ')
        if (mess[0] == 'run') {
            run()
        }
        if (mess[0] == 'back') {
            backToPlayer()
        }
        if (mess[0] == 'stop') {
            need_restart = false
            playerStop = true
            bot.pathfinder.stop()
            bot.stopDigging()
        }
        if (mess[0] == 'chest') {
            putInChest()
        }
        if (mess[0] == 'drop') {
            dropItem()
        }
        if (mess[0] == 'chatbag') {
            chatBag()
        }
        if (mess[0] == 'set') {
            if (mess[1] == 'chest') {
                chestPos[0] = mess[2]
                chestPos[1] = mess[3]
                chestPos[2] = mess[4]
            }
            if (mess[1] == 'cheston') {
                const boss = bot.players[bossName]
                if (!boss) {
                    console.log('获取失败 你距离机器人太远 请手动设置位置 set chest [x] [y] [z]')
                    return
                }
                chestPos[0] = (boss.entity.position.x) + 1
                chestPos[1] = (boss.entity.position.y) + 1
                chestPos[2] = (boss.entity.position.z) + 1
            }
            if (mess[1] == 'max') {
                max_ore = Number(mess[2])
            }
            if (mess[1] == 'findName') {
                if (mcData.blocksByName[mess[2]]) {
                    findName = mess[2]
                } else {
                    console.log('找不到此矿物')
                }

            }
            if (mess[2] == 'submitName') {
                if (mcData.blocksByName[mess[2]]) {
                    submitName = mess[2]
                } else {
                    console.log('找不到此矿物')
                }
            }
        }
        if (mess[0] == 'pos') {
            console.log('位置：' + bot.entity.position.x + ' ' + bot.entity.position.y + ' ' + bot.entity.position.z)
        }
        if (mess[0] == 'armor') { takeArmor() }

        if (mess[0] == 'autoset') {
            if (mess[1].includes('钻')) {
                findName = 'diamond_ore'
                submitName = 'diamond'
            }
            if (mess[1].includes('铁')) {
                findName = 'iron_ore'
                if (Number(version) >= 1.17) {
                    submitName = 'raw_iron'
                } else {
                    submitName = 'iron_ore'
                }

            } else if (mess[1].includes('金')) {
                findName = 'gold_ore'
                if (Number(version) >= 1.17) {
                    submitName = 'raw_gold'
                } else {
                    submitName = 'gold_ore'
                }
            } else if (mess[1].includes('煤')) {
                findName = 'coal_ore'
                submitName = 'coal'
            } else if (mess[1].includes('青')) {
                findName = 'lapis_lazuli'
                submitName = 'lapis_ore'
            } else if (mess[1].includes('残骸')) {
                findName = 'ancient_debris'
                submitName = 'ancient_debris'
            } else if (mess[1].includes('绿')) {
                findName = 'emerald_ore'
                submitName = 'emerald'
            }

        }
        if (mess[0] == 'query') {
            console.log('名字 findName              submitName')
            console.log('---------------------------------------')
            console.log('钻石-diamond_ore           diamond')
            console.log('    -deepslate_diamond_ore')
            console.log('---------------------------------------')
            console.log('铁  -iron_ore              iron_ore (raw_iron 1.17+)')
            console.log('    -deepslate_iron_ore    ')
            console.log('---------------------------------------')
            console.log('金子-gold_ore              gold_ore (raw_gold 1.17+)')
            console.log('    -deepslate_gold_ore')
            console.log('---------------------------------------')
            console.log('宝石-emerald_ore           emerald')
            console.log('    -deepslate_emerald_ore')
            console.log('---------------------------------------')
            console.log('煤  -coal_ore              coal')
            console.log('    -deepslate_coal_ore')
            console.log('---------------------------------------')
            console.log('青金-lapis_ore             lapis_lazuli')
            console.log('    -deepslate_lapis_ore')
            console.log('---------------------------------------')
            console.log('残骸-ancient_debris        ancient_debris')
        }

    })

    setInterval(() => {
        if (need_restart) {
            console.log('重启函数执行')
            run()
        }
    }, 3000);

    setInterval(self_defense, 800)

})




