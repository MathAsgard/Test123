const { expect } = require("chai");
const { ethers, upgrade, network } = require("hardhat");
const { formatEther, parseEther } = require("ethers").utils;
const hre = require("hardhat");
require("@nomicfoundation/hardhat-chai-matchers")
const { loadFixture, time, takeSnapshot, hardhat_fork } = require("@nomicfoundation/hardhat-network-helpers");
const { link } = require("fs");
const { random, constant } = require("underscore");
const constants = require("../constants.js");
const exp = require("constants");

let snapshot;

let TestAccount;
let DevAccount;

const refAccount = '0x64edCA441aaE7B3dDA4B23f2cd6546c501ab894f';

// await hardhat_fork({ network: 'hardhat' });

async function setBalance(address, amount) {
  await ethers.provider.send("hardhat_setBalance", [address, ethers.utils.parseEther(amount).toHexString()]);
}

describe("DDD", function () {
  async function deployTokenFixture() {
    const taxPoints = 8000;
    const linkAddress = "0x404460C6A5EdE2D891e8297795264fDe62ADBB75";
    const vrfWrapper = "0x721DFbc5Cfe53d32ab00A9bdFa605d3b8E1f3f42";
    const vrfCoordinator = "0xc587d9053cd1118f25F645F9E08BB98c9712A4EE";

    const signers = await hre.ethers.getSigners();
    TestAccount = signers[1];
    console.log("TestAccount: ", TestAccount.address);
    // impersonate dev account
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [constants.dev],
    });

    DevAccount = await ethers.getSigner(constants.dev);
    console.log(
      "Dev account before transaction",
      ethers.utils.formatEther(await DevAccount.getBalance())
    );

    await setBalance(DevAccount.address, "1000");

    console.log(
      "Dev account after transaction",
      ethers.utils.formatEther(await DevAccount.getBalance())
    );

    const Router = await hre.ethers.getContractFactory("PancakeRouter");
    const PriceReader = await hre.ethers.getContractFactory("DripPriceReaderV1");
    const ERCToken = await hre.ethers.getContractFactory("ERCToken");
    const Fountain = await hre.ethers.getContractFactory("Fountain");
    const Faucet = await hre.ethers.getContractFactory("FaucetV6");
    const Broker = await hre.ethers.getContractFactory("DripBroker", DevAccount);
    const RandomNumberGenerator = await hre.ethers.getContractFactory(
      "RandomNumberGenerator", DevAccount
    );
    const UniswapV2Library = await hre.ethers.getContractFactory(
      "UniswapV2Library"
    );
    const UniswapV2OracleLibrary = await hre.ethers.getContractFactory(
      "UniswapV2OracleLibrary"
    );
    const DripTWAP = await hre.ethers.getContractFactory("DripTWAP", DevAccount);
    const DripDropDraw = await hre.ethers.getContractFactory("DripDropDraw", DevAccount);
    // deploy random number generator
    // const rng = await RandomNumberGenerator.deploy(linkAddress, vrfWrapper);
    // await rng.deployed();


    const rng = await RandomNumberGenerator.attach(constants.rng);
    console.log("rng deployed: ", rng.address);

    const ddd = await upgrades.deployProxy(DripDropDraw, [rng.address], { initializer: 'initialize' });
    await ddd.deployed();
    console.log("ddd deployed: ", ddd.address);

    await rng.setDripDropDraw(ddd.address);
    console.log("rng set ddd: ", ddd.address);

    // eploy twap
    const twap = await DripTWAP.attach(constants.twap);
    console.log("twap deployed: ", twap.address);

    // call twap
    await ddd.setTwap(twap.address);

    await twap.update();
    console.log("twap updated");

    // move block forward by 5 minutes
    await time.increase(300);
    console.log("time increased by 5 minutes");
    await twap.update();
    console.log("twap updated");

    //deploy broker
    const broker = await upgrades.deployProxy(Broker, [
      constants.drip,
      constants.usdc,
      constants.fountain,
      constants.faucet,
      constants.router,
      taxPoints
    ], { initializer: 'initialize' });
    await broker.deployed();
    console.log("broker deployed: ", broker.address);

    snapshot = await takeSnapshot();

    const faucet = await Faucet.attach(constants.faucet);

    const fountain = await Fountain.attach(constants.fountain);

    const busd = await ERCToken.attach(constants.busd);

    const drip = await ERCToken.attach(constants.drip);

    const priceReader = await PriceReader.attach(constants.priceReader);

    const router = await Router.attach(constants.router);


    // Fixtures can return anything you consider useful for your tests
    return { ddd, broker, twap, rng, faucet, fountain, busd, drip, priceReader, router };
  }

  // it("deployed ddd contracts", async function () {

  //   const { ddd, rng, twap, broker, faucet, fountain, busd, drip } = await loadFixture(deployTokenFixture);
  //   await expect(ddd.address).to.be.properAddress;
  //   await expect(rng.address).to.be.properAddress;
  //   await expect(twap.address).to.be.properAddress;
  //   await expect(broker.address).to.be.properAddress;
  //   await expect(faucet.address).to.be.properAddress;
  //   await expect(fountain.address).to.be.properAddress;
  //   await expect(busd.address).to.be.properAddress;
  //   await expect(drip.address).to.be.properAddress;
  // });

  // it("cant deposit without drip in faucet", async function () {
  //   const { ddd, rng, twap, broker } = await loadFixture(deployTokenFixture);

  //   await expect(ddd.connect(TestAccount).buyTicketsWithBNB(TestAccount.address, TestAccount.address, false, { value: ethers.utils.parseUnits("5") })).to.be.revertedWith("User need more DRIP in faucet");
  //   // expect(stakeInfo.deposit_time).to.equal(REWARD_START_TIME);
  // });

  // it('cant deposit if round not started', async function () {
  //   const { ddd, rng, twap, broker, faucet, fountain, busd, drip } = await loadFixture(deployTokenFixture);

  //   // check drip balance
  //   const dripBalance = await drip.balanceOf(DevAccount.address);
  //   console.log("drip balance: ", ethers.utils.formatEther(dripBalance));

  //   // check faucet balance
  //   const faucetBalance = await faucet.userInfo(DevAccount.address);
  //   console.log("faucet balance: ", ethers.utils.formatEther(faucetBalance.deposits));

  //   // check current round
  //   const currentRound = await ddd.currentRound();
  //   console.log("current round: ", currentRound);

  //   // check round info
  //   const roundInfo = await ddd.roundsInfo(currentRound);
  //   // console.log("round info: ", roundInfo);

  //   expect(roundInfo.active).to.equal(false);

  //   await expect(ddd.connect(DevAccount).buyTicketsWithBNB(DevAccount.address, refAccount, false, { value: ethers.utils.parseUnits("5") })).to.be.reverted;
  // });

  // it('can deposit once round has been initiated', async function () {
  //   const { ddd, rng, twap, broker, faucet, fountain, busd, drip } = await loadFixture(deployTokenFixture);

  //   const currentRound = await ddd.currentRound();
  //   console.log("current round: ", currentRound);

  //   // check round info
  //   let roundInfo = await ddd.roundsInfo(currentRound);
  //   console.log(`round ${currentRound} active:  ${roundInfo.active}`);

  //   // initate round
  //   await ddd.connect(DevAccount).initiateNextRound();

  //   // check current round
  //   const currentRound2 = await ddd.currentRound();
  //   console.log(`round ${currentRound2} active:  ${roundInfo.active}`)

  //   // check round info
  //   roundInfo = await ddd.roundsInfo(currentRound);
  //   expect(roundInfo.active).to.equal(true);

  //   expect(await ddd.connect(DevAccount).buyTicketsWithBNB(DevAccount.address,refAccount, false, { value: ethers.utils.parseUnits("5") })).to.be.ok;    

  // });

  // it('can buy with drip, busd, and bnb', async function () {
  //   const { ddd, rng, twap, broker, faucet, fountain, busd, drip, priceReader, router } = await loadFixture(deployTokenFixture);

  //   await ddd.connect(DevAccount).initiateNextRound();

  //   expect(await ddd.connect(DevAccount).buyTicketsWithBNB(DevAccount.address, refAccount, false, { value: ethers.utils.parseUnits("5") })).to.be.ok;

  //   // check drip balance
  //   const dripBalance = await drip.balanceOf(DevAccount.address);
  //   console.log("drip balance: ", ethers.utils.formatEther(dripBalance));

  //   // buy drip off fountain
  //   await fountain.connect(DevAccount).bnbToTokenSwapInput(1, { value: ethers.utils.parseUnits("5") });

  //   // check drip balance
  //   const dripBalance2 = await drip.balanceOf(DevAccount.address);
  //   console.log("drip balance: ", ethers.utils.formatEther(dripBalance2));

  //   // approve ddd to spend drip
  //   await drip.connect(DevAccount).approve(ddd.address, ethers.utils.parseUnits("5000000"));

  //   expect(await ddd.connect(DevAccount).buyTicketsWithDRIP(DevAccount.address, refAccount, ethers.utils.parseUnits("5"), false)).to.be.ok;    

  //   console.log('bought tickets with drip');

  //   // swap bnb for busd    
  //   await router.connect(DevAccount).swapExactETHForTokens(0, [constants.wbnb, constants.busd], DevAccount.address, Math.floor(Date.now() / 1000) + 60 * 20, { value: ethers.utils.parseUnits("5") });

  //   // check busd amount
  //   const busdBalance = await busd.balanceOf(DevAccount.address);
  //   console.log("busd balance: ", ethers.utils.formatEther(busdBalance));

  //   // approve ddd to spend busd
  //   await busd.connect(DevAccount).approve(ddd.address, ethers.utils.parseUnits("500000000"));

  //   expect(await ddd.connect(DevAccount).buyTicketsWithBUSD(DevAccount.address, refAccount, ethers.utils.parseUnits("5"), false)).to.be.ok;    
  // });

  // it('buys with drip and uses accurate drip pricing per ticket', async function () {
  //   const { ddd, rng, twap, broker, faucet, fountain, busd, drip, priceReader } = await loadFixture(deployTokenFixture);

  //   await ddd.connect(DevAccount).initiateNextRound();

  //   // check drip balance
  //   const dripBalance = await drip.balanceOf(DevAccount.address);
  //   console.log("drip balance: ", ethers.utils.formatEther(dripBalance));   

  //   // buy drip off fountain
  //   await fountain.connect(DevAccount).bnbToTokenSwapInput(1, { value: ethers.utils.parseUnits("5") });

  //   // check drip balance
  //   const dripBalance2 = await drip.balanceOf(DevAccount.address);
  //   console.log("drip balance: ", ethers.utils.formatEther(dripBalance2));

  //   // amount of drip bought
  //   const dripBought = dripBalance2.sub(dripBalance);
  //   console.log("drip bought: ", ethers.utils.formatEther(dripBought));

  //   // round dripBought down to next whole number
  //   const dripBoughtRounded = dripBought.div(ethers.utils.parseUnits("1")).mul(ethers.utils.parseUnits("1"));

  //   console.log("drip bought rounded: ", ethers.utils.formatEther(dripBoughtRounded));

  //   // check drip price
  //   let { bnbPrice, dripFountainPrice } = await priceReader.getAllStats();

  //   console.log("bnb price: ", ethers.utils.formatEther(bnbPrice));
  //   console.log("drip fountain price: ", ethers.utils.formatEther(dripFountainPrice));

  //   // get quote for drip
  //   const ticketQuote = await ddd.connect(DevAccount).quoteTicketsFromDRIP(dripBoughtRounded);
  //   console.log("ticket quote for drip: ", ethers.utils.formatEther(ticketQuote));

  //   // check twap price of drip
  //   const dripTwap = await twap.consult(constants.drip, ethers.utils.parseUnits("1"));
  //   console.log("drip twap: ", ethers.utils.formatEther(dripTwap) * ethers.utils.formatEther(bnbPrice));

  //   // check current round info
  //   const currentRound = await ddd.currentRound();
  //   console.log("current round: ", currentRound);

  //   // check round info
  //   let oldPlayerDetails = await ddd.ticketsPlayerDetails(currentRound, DevAccount.address);
  //   console.log("paid quantity: ", ethers.utils.formatEther(oldPlayerDetails.paidQuantity));
  //   console.log("free quantity: ", ethers.utils.formatEther(oldPlayerDetails.freeQuantity));
  //   console.log("total quantity: ", ethers.utils.formatEther(oldPlayerDetails.totalQuantity));

  //   // approve ddd to spend drip max amount    
  //   await drip.connect(DevAccount).approve(ddd.address, ethers.constants.MaxUint256);

  //   // buy tickets with drip
  //   await ddd.connect(DevAccount).buyTicketsWithDRIP(DevAccount.address, refAccount, dripBoughtRounded, false);

  //   // check tickets bought
  //   const currentPlayerDetails = await ddd.ticketsPlayerDetails(currentRound, DevAccount.address);    

  //   console.log("new paid tickets: ", ethers.utils.formatEther(currentPlayerDetails.paidQuantity) - ethers.utils.formatEther(oldPlayerDetails.paidQuantity));
  //   console.log("free quantity: ", ethers.utils.formatEther(currentPlayerDetails.freeQuantity));
  //   console.log("total quantity: ", ethers.utils.formatEther(currentPlayerDetails.totalQuantity));

  //   expect(ticketQuote).to.equal(currentPlayerDetails.paidQuantity);
  // });

  // it('ends round and starts new round', async function () {
  //   const { ddd, rng, twap, broker, faucet, fountain, busd, drip, priceReader } = await loadFixture(deployTokenFixture);

  //   // check twap price of drip
  //   let { bnbPrice, dripFountainPrice } = await priceReader.getAllStats();
  //   const dripTwap = await twap.consult(constants.drip, ethers.utils.parseUnits("1"));
  //   console.log("drip twap: ", ethers.utils.formatEther(dripTwap) * ethers.utils.formatEther(bnbPrice));

  //   await ddd.connect(DevAccount).initiateNextRound();

  //   await ddd.connect(DevAccount).buyTicketsWithBNB(DevAccount.address, refAccount, false, { value: ethers.utils.parseUnits("5") });

  //   // check current round info
  //   const currentRound = await ddd.currentRound();
  //   console.log("current round: ", currentRound);

  //   // check round info
  //   let roundInfo = await ddd.roundsInfo(currentRound);
  //   console.log(`round ${currentRound} active:  ${roundInfo.active}`);

  //   // get blocktime
  //   const timestamp = await time.latest();
  //   console.log("block time: ", timestamp);

  //   console.log('moving time up 4 hours');
  //   // move block time up 4 hours
  //   await time.increase(60 * 60 * 5);
  //   // check block time
  //   const blockTime = await time.latest();
  //   console.log("block time: ", blockTime);

  //   // end round
  //   expect(await ddd.connect(DevAccount).endRound()).to.be.ok;

  //   // check round info
  //   roundInfo = await ddd.roundsInfo(currentRound);
  //   console.log(`round ${currentRound} active:  ${roundInfo.active}`);

  //   expect(roundInfo.active).to.equal(false);

  //   // mock chainlink vrf callback
  //   await rng.mockFulfillRandomWords(rng.lastRequestId(), [1, 1, 1, 1, 1]);

  //   // check new round
  //   const newRound = await ddd.currentRound();
  //   console.log("new round: ", newRound);

  //   expect(newRound).to.equal(currentRound.add(1));

  //   // check round info
  //   roundInfo = await ddd.roundsInfo(newRound);
  //   console.log(`round ${newRound} active:  ${roundInfo.active}`);

  //   expect(roundInfo.active).to.equal(true);
  // });

  it('ends round and starts new round', async function () {
    const { ddd, rng, twap, broker, faucet, fountain, busd, drip, priceReader } = await loadFixture(deployTokenFixture);

    // check twap price of drip
    let { bnbPrice, dripFountainPrice } = await priceReader.getAllStats();
    const dripTwap = await twap.consult(constants.drip, ethers.utils.parseUnits("1"));
    console.log("drip twap: ", ethers.utils.formatEther(dripTwap) * ethers.utils.formatEther(bnbPrice));

    await ddd.connect(DevAccount).initiateNextRound();

    await ddd.connect(DevAccount).buyTicketsWithBNB(DevAccount.address, refAccount, false, { value: ethers.utils.parseUnits("5") });

    // check current round info
    const currentRound = await ddd.currentRound();
    console.log("current round: ", currentRound);

    // check round info
    let roundInfo = await ddd.roundsInfo(currentRound);
    console.log(`round ${currentRound} active:  ${roundInfo.active}`);

    // get blocktime
    const timestamp = await time.latest();
    console.log("block time: ", timestamp);

    console.log('moving time up 4 hours');
    // move block time up 4 hours
    await time.increase(60 * 60 * 5);
    // check block time
    const blockTime = await time.latest();
    console.log("block time: ", blockTime);

    // end round
    expect(await ddd.connect(DevAccount).endRound()).to.be.ok;

    // check round info
    roundInfo = await ddd.roundsInfo(currentRound);
    console.log(`round ${currentRound} active:  ${roundInfo.active}`);

    expect(roundInfo.active).to.equal(false);

    // mock chainlink vrf callback
    await rng.mockFulfillRandomWords(rng.lastRequestId(), [1, 1, 1, 1, 1]);

    // check new round
    const newRound = await ddd.currentRound();
    console.log("new round: ", newRound);

    expect(newRound).to.equal(currentRound.add(1));

    // check round info
    roundInfo = await ddd.roundsInfo(newRound);
    console.log(`round ${newRound} active:  ${roundInfo.active}`);

    expect(roundInfo.active).to.equal(true);
  });

  it('multiple accounts buy in and close round', async function () {
    this.timeout(1000000 * 5); // timeout for 5 rounds

    const { ddd, rng, twap, broker, faucet, fountain, busd, drip } = await loadFixture(deployTokenFixture);
    const bnbWhale = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [bnbWhale],
    });

    const whaleSigner = await ethers.getSigner(bnbWhale);
    const addresses = ["0x7c40f272570fdf9549d6f67493ac250a1db52f27",
      "0xF1cBeE93322e0f4774a11ab116c223E16C0c6E7e",
      "0x669e3103b14E2b8981231ea35fa012b7e920Cdcb",
      // "0x60bEE008558802cDeb5f6B43dbC14D0c1D87DfC9",
      // "0x17798E41FA7B686EC4d2c1cf8631693857Fe8864",
      // "0x7cAA81EB08Bc912A4260343aA135728B7Db65bfa",
      // "0x065c7EB443E7Df08470e8230f06a7670a91c5B0d",
      // "0x7f38C72186FA4D05a963aaC8a30835519178F8E4",
      // "0x0e29CCe43B138aCd1Ae0CBfC36D85320f7f36951",
      // "0xf121Fb2f2ee7ce8Da61aecb39c82B0843D25AAC9",
      // "0xD3a9d233b945a39D199aD8A726a0B302Cd063965",
      // "0xF6D8A2576E3dc28AF8d5DC6935b94AB51F4A98e6",
      // "0xB82EDb4092a3EF3bc40d895f09a3744759fbdeda",
      // "0xf83fBe72B07B6b67B06CFb2232c2A3335b0b0679",
      // "0x8270fE62466C8399653BCE8E9bf4CF203d785e47",
      // "0xDB7A3d6c408F1A41865d6Fd662e5Cc9B3Eb19c08",
      // "0x2b156B898618A58ED496edcE6BaeC2389987D803",
      // "0xC87FC496D76d13e1B9986107e5a838156502121A",
      // "0x96f77B82B6D16b683E2B208b85bf9356B6e0Aa9E",
      // "0xA6D4f7b40fC45C2A649538D8e58131E38Cc26737",
      // "0x01b9BCb31A030c277300Bcd040b8058454e90105",
      // "0x7c40f272570fdf9549d6f67493ac250a1db52f27"
    ];

    for (const address of addresses) {
      await whaleSigner.sendTransaction({
        to: address,
        value: ethers.utils.parseEther("450"),
      });
    }

    // loop for 5 rounds
    for (let round = 0; round < 8; round++) {
      console.log(`Starting round ${round}`);

      // check twap price of drip
      // let { bnbPrice, dripFountainPrice } = await priceReader.getAllStats();
      // const dripTwap = await twap.consult(constants.drip, ethers.utils.parseUnits("1"));
      // console.log("drip twap: ", ethers.utils.formatEther(dripTwap) * ethers.utils.formatEther(bnbPrice));

      await ddd.connect(DevAccount).initiateNextRound();

      for (const entry of addresses) {
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [entry],
        });

        const signer = await ethers.getSigner(entry);
        const randomValue = entry === '0x7c40f272570fdf9549d6f67493ac250a1db52f27' ? ethers.utils.parseEther('.1') : ethers.utils.parseEther((Math.floor(Math.random() * (50 - 50 + 1)) + 50).toString());
        const randomBool = Math.random() < 0.5;
        let ref = entry === '0x7c40f272570fdf9549d6f67493ac250a1db52f27' ? '0x01b9BCb31A030c277300Bcd040b8058454e90105' : '0x7c40f272570fdf9549d6f67493ac250a1db52f27';
        // console.log("Buy Txn: ", entry, ref, randomBool, randomValue);

        await ddd
          .connect(signer)
          .buyTicketsWithBNB(entry, ref, randomBool, { value: randomValue });

        await hre.network.provider.send("evm_increaseTime", [1 * 60 * 60]);
        await hre.network.provider.send("evm_mine");

        const playerStats = await ddd.connect(signer).playersStats(entry);
        console.log(`Player stats for wallet ${entry}: `, playerStats.toString(), randomBool, randomValue);
      }

      await hre.network.provider.send("evm_increaseTime", [5 * 60 * 60]);
      await hre.network.provider.send("evm_mine");

      const playerStats = await ddd.connect(DevAccount).playersStats("0x7c40f272570fdf9549d6f67493ac250a1db52f27");
      // console.log(`Player stats for wallet 0x7c40f272570fdf9549d6f67493ac250a1db52f27: `, playerStats.toString());

      const lotteryInfo = await ddd.connect(DevAccount).lotteryInfo();
      console.log("lottery Info: ", lotteryInfo);
      const roundNumber = await ddd.connect(DevAccount).currentRound();
      console.log("Round Number: ", roundNumber);
      const currentprizes = await ddd.connect(DevAccount).getCurrentPrizes();
      console.log("prizes: ", currentprizes);
      await ddd.connect(DevAccount).endRound();
      await rng.mockFulfillRandomWords(rng.lastRequestId(), [30003374234200, 2002938293762970, 3083147329194000, 809387408742000, 50384734000]);

      const roundWinners = await ddd.connect(DevAccount).getRoundWinners(roundNumber);
      console.log("Round Winners: ", roundWinners);
      const roundInfo = await ddd.connect(DevAccount).roundsInfo(roundNumber);
      // console.log("Round Info: ", roundInfo);
    }
  });

});
