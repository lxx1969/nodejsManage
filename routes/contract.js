var express = require('express');
var router = express.Router();
const mysql = require('../plugins/mysql');
const {
    setToken,
    getToken
} = require('../plugins/token');

const Web3 = require('web3')
const httpProvider = new Web3(new Web3.providers.HttpProvider('https://ropsten.infura.io/v3/f79cd7e4f03e4c759bcef45c5c841c75'))
const abi = require('../api/fairgame.json')


router.post('/getContractList', async (req, res) => {
    try {
        const {
            state,
            gameName,
            startTime,
            endTime,
            page,
            size
        } = req.body;
        let sql = "SELECT t.game_name,c.contract_address,c.state,c.is_show as contract_is_show,c.pass_lock,g.title,g.is_show,g.type_game_id,g.game_id,g.end_time,g.end_block,g.is_auto_pass,g.clear_block from (game as g join contract_list as c on c.game_id = g.game_id) INNER JOIN type_game_list as t on t.type_game_id = g.type_game_id where 1=1"
        let str = ""
        if (state) {
            str += ` and c.state ='${state}'`;
        }
        if (gameName) {
            str += ` and t.game_name like '%${game_name}%'`;
        }
        if (startTime && endTime) {
            str += `and g.end_time >='${startTime}' and g.end_time <='${endTime}''`;
        }

        sql += str;

        if (page && size) {
            sql += ` order by g.game_id desc limit ${(parseInt(page) - 1) * parseInt(size)},${parseInt(size)}`;
          }

        let data = await mysql.query(sql);

        for(let i = 0;i < data.length;i++){
            data[i].title = JSON.parse(data[i].title)
        }
        res.json({
            code: 200,
            message: 'table表获取成功',
            data: {
                record: data,
                total: data.length
            }
        });
    } catch (e) {
        console.error(e)
        res.json({
            code: 404,
            data: '错误'
        });
    }
});

router.post('/updateState', async (req, res) => {
    try {
        const {
            is_auto_pass,
            contract_is_show,
            pass_lock,
            contract_address
        } = req.body;
        
        let pre = `update contract_list set `;
        let tail = ` where contract_address='${contract_address}'`
        let str = ""
        // if (is_auto_pass) {
        //     str += `  is_auto_pass = ${is_auto_pass},`;
        // }
        if (contract_is_show) {
          str += `  is_show = ${contract_is_show},`;
        }
        if (pass_lock) {
          str += `  pass_lock = ${pass_lock},`;
        }
        
        if (str != "") {
          str = (str.substring(str.length - 1) == ',') ? str.substring(0, str.length - 1) : str;
        }else{
            res.json({
                code: 200,
                message: '无接收到需要修改的参数',
            });
        }
        let sql = pre + str + tail
        var conn = await mysql.getConnection();
        await mysql.beginTransaction(conn);
        await mysql.query2(conn,sql);
        await mysql.commit(conn);
        res.json({
            code: 200,
            message: '修改成功',
        });
    } catch (e) {
        mysql.rollback(conn);
        console.error(e)
        res.json({
            code: 404,
            data: '错误'
        });
    }
});

router.post('/settlementList', async (req, res) => {
    try{
    const {
        game_id,
        contract_address
    } = req.body;
    let sql = `select game_detail from game where game_id = '${game_id}'`

    
    let data = await mysql.query(sql)
    const web3 = new Web3(httpProvider)
    const fairGame = new web3.eth.Contract(abi, contract_address);
    let gameState = await fairGame.methods.getState().call()

    let game_detail = JSON.parse(data[0].game_detail)
    await detailCheck(gameState[3], game_detail)

    res.json({
        code: 200,
        data: game_detail
    });}
    catch(el){
        console.error(el)
        res.json({
            code: 404,
            data: '错误'
        });
    }
});

async function detailCheck(odds, game_detail) {
    for (let j = game_detail.length; j > 0; j--) {
        for (let d = game_detail[j - 1].detail.length; d > 0; d--) {
            if (odds[game_detail[j - 1].detail[d - 1].modulo - 1] == 0 || odds[game_detail[j - 1].detail[d - 1].modulo - 1] == null || odds[game_detail[j - 1].detail[d - 1].modulo - 1] == NaN) {
                game_detail[j - 1].detail.splice(d - 1, 1);
            } else {
                game_detail[j - 1].detail[d - 1].odds = (odds[game_detail[j - 1].detail[d - 1].modulo - 1]) / 100
                delete game_detail[j - 1].detail[d - 1].max_odds
                delete game_detail[j - 1].detail[d - 1].min_odds
            }
            if (game_detail[j - 1].detail.length == 0) {
                game_detail.splice(j - 1, 1)
            }
        }
    }
}


module.exports = router;