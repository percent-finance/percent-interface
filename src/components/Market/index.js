import React, { useEffect, useState } from "react";
import { Row, Col, Card, Table, Button } from "react-bootstrap";
import { withStyles } from "@material-ui/core/styles";
import Switch from "@material-ui/core/Switch";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Aux from "../../hoc/_Aux";
import AppBar from "@material-ui/core/AppBar";
import Box from "@material-ui/core/Box";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import ListSubheader from "@material-ui/core/ListSubheader";
import InputAdornment from "@material-ui/core/InputAdornment";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import Snackbar from "@material-ui/core/Snackbar";
import LinearProgress from "@material-ui/core/LinearProgress";

import { chainIdToName, ethDummyAddress } from "../../constants";
import {
  eX,
  convertToLargeNumberRepresentation,
  roundToDecimalPlaces,
  zeroStringIfNullish,
} from "../../helpers";
import { useWeb3React } from "@web3-react/core";
// import { store } from "../../store";

// import { ethers } from "ethers";
import { MaxUint256 } from "@ethersproject/constants";
const Compound = require("@compound-finance/compound-js/dist/nodejs/src/index.js");
const compoundConstants = require("@compound-finance/compound-js/dist/nodejs/src/constants.js");
const BigNumber = require("bignumber.js");

function Dashboard() {
  // const { state, dispatch } = useContext(store);
  const { account, library } = useWeb3React();
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);
  const [borrowDialogOpen, setBorrowDialogOpen] = useState(false);
  const [enterMarketDialogOpen, setEnterMarketDialogOpen] = useState(false);
  const [selectedMarketDetails, setSelectedMarketDetails] = useState({});
  const [allMarketDetails, setAllMarketDetails] = useState([]);
  const [generalDetails, setGeneralDetails] = useState([]);
  const [gasPrice, setGasPrice] = useState(eX(50, 9));
  const gasLimit = "250000";
  const gasLimitBorrow = "702020";
  const gasLimitEnable = "62020";
  const gasLimitEnterMarket = "112020";

  useEffect(() => {
    (async () => {
      // console.log(
      //   "ethers provider",
      //   new ethers.providers.Web3Provider(window.ethereum)
      // );
      // const providerNetwork = (await provider.getNetwork()).name;
      // const signer = provider.getSigner();
      // const signerAddress = await signer.getAddress();
      // dispatch({
      //   type: "UPDATE_PROVIDER",
      //   provider,
      //   providerNetwork,
      //   signerAddress,
      // });
      // console.log("providerNetwork", providerNetwork);
      // console.log("signerAddress", signerAddress);
      // console.log("provider.getBlockNumber()", provider.getBlockNumber());
      // console.log(
      //   "library is ethers' provider",
      //   await library?.getSigner().getAddress()
      // );

      // const comptrollerAddress = Compound.util.getAddress(
      //   Compound.Comptroller,
      //   chainIdToName[parseInt(library?.provider?.chainId)]
      // );

      const comptrollerAddress = process.env.REACT_APP_COMPTROLLER_ADDRESS;

      if (chainIdToName[parseInt(library?.provider?.chainId)] !== "kovan") {
        setWarningDialogOpen(true);
      }

      const allMarkets = await Compound.eth.read(
        comptrollerAddress,
        "function getAllMarkets() returns (address[])",
        [], // [optional] parameters
        {
          network: chainIdToName[parseInt(library?.provider?.chainId)],
          _compoundProvider: library,
        } // [optional] call options, provider, network, ethers.js "overrides"
      );

      if (account) {
        const enteredMarkets = await Compound.eth.read(
          comptrollerAddress,
          "function getAssetsIn(address) returns (address[])",
          [account], // [optional] parameters
          {
            network: chainIdToName[parseInt(library?.provider?.chainId)],
            _compoundProvider: library,
          } // [optional] call options, provider, network, ethers.js "overrides"
        );

        let totalSupplyBalance = new BigNumber(0);
        let totalBorrowBalance = new BigNumber(0);
        let totalBorrowLimit = new BigNumber(0);
        let yearSupplyInterest = new BigNumber(0);
        let yearBorrowInterest = new BigNumber(0);

        const details = await Promise.all(
          allMarkets.map(async (pTokenAddress) => {
            const underlyingAddress = await getUnderlyingTokenAddress(
              pTokenAddress
            );
            const decimals = await getDecimals(underlyingAddress);
            const underlyingPrice = await getUnderlyingPrice(
              pTokenAddress,
              decimals
            );
            const supplyAndBorrowBalance = await getSupplyAndBorrowBalance(
              pTokenAddress,
              decimals,
              underlyingPrice,
              account
            );
            totalSupplyBalance = totalSupplyBalance.plus(
              supplyAndBorrowBalance?.supplyBalance
            );
            totalBorrowBalance = totalBorrowBalance.plus(
              supplyAndBorrowBalance?.borrowBalance
            );

            const isEnterMarket = enteredMarkets.includes(pTokenAddress);

            const collateralFactor = await getCollateralFactor(
              comptrollerAddress,
              pTokenAddress
            );
            totalBorrowLimit = totalBorrowLimit.plus(
              isEnterMarket
                ? supplyAndBorrowBalance?.supplyBalance.times(collateralFactor)
                : 0
            );

            const supplyApy = await getSupplyApy(pTokenAddress);
            const borrowApy = await getBorrowApy(pTokenAddress);
            yearSupplyInterest = yearSupplyInterest.plus(
              supplyAndBorrowBalance?.supplyBalance.times(supplyApy).div(100)
            );
            yearBorrowInterest = yearBorrowInterest.plus(
              supplyAndBorrowBalance?.borrowBalance.times(borrowApy).div(100)
            );

            const underlyingAmount = await getUnderlyingAmount(
              pTokenAddress,
              decimals
            );

            return {
              pTokenAddress,
              underlyingAddress,
              symbol: await getTokenSymbol(underlyingAddress),
              supplyApy,
              borrowApy,
              underlyingAllowance: await getAllowance(
                underlyingAddress,
                decimals,
                account,
                pTokenAddress
              ),
              walletBalance: await getBalanceOf(
                underlyingAddress,
                decimals,
                account
              ),
              supplyBalanceInTokenUnit:
                supplyAndBorrowBalance?.supplyBalanceInTokenUnit,
              supplyBalance: supplyAndBorrowBalance?.supplyBalance,
              borrowBalanceInTokenUnit:
                supplyAndBorrowBalance?.borrowBalanceInTokenUnit,
              borrowBalance: supplyAndBorrowBalance?.borrowBalance,
              isEnterMarket,
              underlyingAmount,
              underlyingPrice,
              liquidity: +underlyingAmount * +underlyingPrice,
              decimals,
            };
          })
        );

        setGeneralDetails({
          comptrollerAddress,
          totalSupplyBalance,
          totalBorrowBalance,
          totalBorrowLimit,
          totalBorrowLimitUsedPercent: totalBorrowBalance
            .div(totalBorrowLimit)
            .times(100),
          yearSupplyInterest,
          yearBorrowInterest,
          netApy: yearSupplyInterest
            .minus(yearBorrowInterest)
            .div(totalSupplyBalance)
            .times(100),
        });

        setAllMarketDetails(details);
      }
      await updateGasPrice();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library, account]);

  const getUnderlyingTokenAddress = async (pTokenAddress) => {
    try {
      return await Compound.eth.read(
        pTokenAddress,
        "function underlying() returns (address)",
        [], // [optional] parameters
        {
          network: chainIdToName[parseInt(library?.provider?.chainId)],
          _compoundProvider: library,
        } // [optional] call options, provider, network, ethers.js "overrides"
      );
    } catch (error) {
      if (error.error.code === "CALL_EXCEPTION") {
        return ethDummyAddress;
      } else {
        throw error;
      }
    }
  };

  const getTokenSymbol = async (address) => {
    const saiAddress = Compound.util.getAddress(
      Compound.SAI,
      chainIdToName[parseInt(library?.provider?.chainId)]
    );
    let symbol;
    if (address.toLowerCase() === saiAddress.toLowerCase()) {
      symbol = "SAI";
    } else if (address === ethDummyAddress) {
      symbol = "ETH";
    } else {
      symbol = await Compound.eth.read(
        address,
        "function symbol() returns (string)",
        [], // [optional] parameters
        {
          network: chainIdToName[parseInt(library?.provider?.chainId)],
          _compoundProvider: library,
        } // [optional] call options, provider, network, ethers.js "overrides"
      );
    }
    return symbol;
  };

  const getSupplyApy = async (address) => {
    if (library) {
      const mantissa = 1e18; // mantissa is the same even the underlying asset has different decimals
      const blocksPerDay = 4 * 60 * 24;
      const daysPerYear = 365;

      let supplyRatePerBlock;
      try {
        supplyRatePerBlock = await Compound.eth.read(
          address,
          "function supplyRatePerBlock() returns (uint256)",
          [], // [optional] parameters
          {
            network: chainIdToName[parseInt(library.provider.chainId)],
            _compoundProvider: library,
          } // [optional] call options, provider, network, ethers.js "overrides"
        );
      } catch (e) {
        supplyRatePerBlock = new BigNumber(0);
      }

      const supplyApy =
        (Math.pow(
          (supplyRatePerBlock.toNumber() / mantissa) * blocksPerDay + 1,
          daysPerYear - 1
        ) -
          1) *
        100;
      return supplyApy;
    }
  };

  const getBorrowApy = async (address) => {
    if (library) {
      const mantissa = 1e18; // mantissa is the same even the underlying asset has different decimals
      const blocksPerDay = 4 * 60 * 24;
      const daysPerYear = 365;

      let borrowRatePerBlock;
      try {
        borrowRatePerBlock = await Compound.eth.read(
          address,
          "function borrowRatePerBlock() returns (uint256)",
          [], // [optional] parameters
          {
            network: chainIdToName[parseInt(library.provider.chainId)],
            _compoundProvider: library,
          } // [optional] call options, provider, network, ethers.js "overrides"
        );
      } catch (e) {
        borrowRatePerBlock = new BigNumber(0);
      }

      const borrowApy =
        (Math.pow(
          (borrowRatePerBlock.toNumber() / mantissa) * blocksPerDay + 1,
          daysPerYear - 1
        ) -
          1) *
        100;
      return borrowApy;
    }
  };

  const getDecimals = async (tokenAddress) => {
    if (library) {
      let decimals;
      if (tokenAddress === ethDummyAddress) {
        decimals = 18;
      } else {
        decimals = await Compound.eth.read(
          tokenAddress,
          "function decimals() returns (uint8)",
          [], // [optional] parameters
          {
            network: chainIdToName[parseInt(library.provider.chainId)],
            _compoundProvider: library,
          } // [optional] call options, provider, network, ethers.js "overrides"
        );
      }

      return decimals;
    }
  };

  const getBalanceOf = async (tokenAddress, decimals, walletAddress) => {
    if (library) {
      let balance;
      if (tokenAddress === ethDummyAddress) {
        balance = await library.getBalance(walletAddress);
      } else {
        balance = await Compound.eth.read(
          tokenAddress,
          "function balanceOf(address) returns (uint)",
          [walletAddress], // [optional] parameters
          {
            network: chainIdToName[parseInt(library.provider.chainId)],
            _compoundProvider: library,
          } // [optional] call options, provider, network, ethers.js "overrides"
        );
      }

      return eX(balance.toString(), -1 * decimals);
    }
  };

  const getAllowance = async (
    tokenAddress,
    decimals,
    walletAddress,
    pTokenAddress
  ) => {
    if (library) {
      let allowance;
      if (tokenAddress === ethDummyAddress) {
        allowance = MaxUint256;
      } else {
        allowance = await Compound.eth.read(
          tokenAddress,
          "function allowance(address, address) returns (uint)",
          [walletAddress, pTokenAddress], // [optional] parameters
          {
            network: chainIdToName[parseInt(library.provider.chainId)],
            _compoundProvider: library,
          } // [optional] call options, provider, network, ethers.js "overrides"
        );
      }

      return eX(allowance.toString(), -1 * decimals);
    }
  };

  const getSupplyAndBorrowBalance = async (
    tokenAddress,
    decimals,
    underlyingPrice,
    walletAddress
  ) => {
    if (library) {
      const accountSnapshot = await Compound.eth.read(
        tokenAddress,
        "function getAccountSnapshot(address) returns (uint, uint, uint, uint)",
        [walletAddress], // [optional] parameters
        {
          network: chainIdToName[parseInt(library.provider.chainId)],
          _compoundProvider: library,
        } // [optional] call options, provider, network, ethers.js "overrides"
      );

      const supplyBalanceInTokenUnit = eX(
        accountSnapshot[1].mul(accountSnapshot[3]).toString(),
        -1 * decimals - 18
      );
      const supplyBalanceInUsd = supplyBalanceInTokenUnit.times(
        underlyingPrice
      );
      const borrowBalanceInTokenUnit = eX(
        accountSnapshot[2].toString(),
        -1 * decimals
      );
      const borrowBalanceInUsd = borrowBalanceInTokenUnit.times(
        underlyingPrice
      );

      return {
        supplyBalanceInTokenUnit,
        supplyBalance: supplyBalanceInUsd,
        borrowBalanceInTokenUnit,
        borrowBalance: borrowBalanceInUsd,
      };
    }
  };

  const getCollateralFactor = async (comptrollerAddress, tokenAddress) => {
    if (library) {
      const market = await Compound.eth.read(
        comptrollerAddress,
        "function markets(address) returns (bool, uint, bool)",
        [tokenAddress], // [optional] parameters
        {
          network: chainIdToName[parseInt(library.provider.chainId)],
          _compoundProvider: library,
        } // [optional] call options, provider, network, ethers.js "overrides"
      );
      return eX(market[1].toString(), -18);
    }
  };

  const getUnderlyingAmount = async (tokenAddress, decimals) => {
    if (library) {
      const underlyingAmount = await Compound.eth.read(
        tokenAddress,
        "function getCash() returns (uint)",
        [], // [optional] parameters
        {
          network: chainIdToName[parseInt(library.provider.chainId)],
          _compoundProvider: library,
        } // [optional] call options, provider, network, ethers.js "overrides"
      );

      return eX(underlyingAmount.toString(), -1 * decimals);
    }
  };

  const getUnderlyingPrice = async (tokenAddress, decimals) => {
    if (library) {
      // const priceFeedAddress = Compound.util.getAddress(
      //   Compound.PriceFeed,
      //   chainIdToName[parseInt(library?.provider?.chainId)]
      // );

      const priceFeedAddress = process.env.REACT_APP_ORACLE_ADDRESS;

      const underlyingPrice = await Compound.eth.read(
        priceFeedAddress,
        "function getUnderlyingPrice(address) returns (uint)",
        [tokenAddress], // [optional] parameters
        {
          network: chainIdToName[parseInt(library.provider.chainId)],
          _compoundProvider: library,
        } // [optional] call options, provider, network, ethers.js "overrides"
      );

      return eX(underlyingPrice.toString(), decimals - 36);
    }
  };

  const handleEnable = async (
    underlyingAddress,
    pTokenAddress,
    setTxSnackbarMessage,
    setTxSnackbarOpen
  ) => {
    try {
      const tx = await Compound.eth.trx(
        underlyingAddress,
        "approve",
        [pTokenAddress, MaxUint256], // [optional] parameters
        {
          network: chainIdToName[parseInt(library.provider.chainId)],
          provider: library.provider,
          gasLimitEnable,
          gasPrice: gasPrice.toString(),
          abi: compoundConstants.abi.cErc20,
        } // [optional] call options, provider, network, ethers.js "overrides"
      );
      console.log("tx", JSON.stringify(tx));
      setTxSnackbarMessage(`Transaction sent: ${tx.hash}`);
    } catch (e) {
      setTxSnackbarMessage("Error occurred!");
    }

    setTxSnackbarOpen(true);
  };

  const handleSupply = async (
    underlyingAddress,
    pTokenAddress,
    amount,
    decimals,
    setTxSnackbarMessage,
    setTxSnackbarOpen
  ) => {
    let parameters = [];
    let options = {
      network: chainIdToName[parseInt(library.provider.chainId)],
      provider: library.provider,
      gasLimit,
      gasPrice: gasPrice.toString(),
    };

    if (underlyingAddress === ethDummyAddress) {
      options.value = eX(amount, 18).toString();
      options.abi = compoundConstants.abi.cEther;
    } else {
      parameters.push(eX(amount, decimals).toString());
      options.abi = compoundConstants.abi.cErc20;
    }

    try {
      const tx = await Compound.eth.trx(
        pTokenAddress,
        "mint",
        parameters, // [optional] parameters
        options // [optional] call options, provider, network, ethers.js "overrides"
      );
      console.log("tx", JSON.stringify(tx));
      setTxSnackbarMessage(`Transaction sent: ${tx.hash}`);
    } catch (e) {
      setTxSnackbarMessage("Error occurred!");
    }

    setTxSnackbarOpen(true);
  };

  const handleWithdraw = async (
    underlyingAddress,
    pTokenAddress,
    amount,
    decimals,
    setTxSnackbarMessage,
    setTxSnackbarOpen
  ) => {
    const options = {
      network: chainIdToName[parseInt(library.provider.chainId)],
      provider: library.provider,
      gasLimit,
      gasPrice: gasPrice.toString(),
    };

    if (underlyingAddress === ethDummyAddress) {
      options.abi = compoundConstants.abi.cEther;
    } else {
      options.abi = compoundConstants.abi.cErc20;
    }

    try {
      const tx = await Compound.eth.trx(
        pTokenAddress,
        "redeemUnderlying",
        [eX(amount, decimals).toString()], // [optional] parameters
        options // [optional] call options, provider, network, ethers.js "overrides"
      );
      console.log("tx", JSON.stringify(tx));
      setTxSnackbarMessage(`Transaction sent: ${tx.hash}`);
    } catch (e) {
      setTxSnackbarMessage("Error occurred!");
    }

    setTxSnackbarOpen(true);
  };

  const handleBorrow = async (
    underlyingAddress,
    pTokenAddress,
    amount,
    decimals,
    setTxSnackbarMessage,
    setTxSnackbarOpen
  ) => {
    const options = {
      network: chainIdToName[parseInt(library.provider.chainId)],
      provider: library.provider,
      gasLimit: gasLimitBorrow,
      gasPrice: gasPrice.toString(),
    };

    if (underlyingAddress === ethDummyAddress) {
      options.abi = compoundConstants.abi.cEther;
    } else {
      options.abi = compoundConstants.abi.cErc20;
    }

    try {
      const tx = await Compound.eth.trx(
        pTokenAddress,
        "borrow",
        [eX(amount, decimals).toString()], // [optional] parameters
        options // [optional] call options, provider, network, ethers.js "overrides"
      );
      console.log("tx", JSON.stringify(tx));
      setTxSnackbarMessage(`Transaction sent: ${tx.hash}`);
    } catch (e) {
      setTxSnackbarMessage("Error occurred!");
    }

    setTxSnackbarOpen(true);
  };

  const handleRepay = async (
    underlyingAddress,
    pTokenAddress,
    amount,
    decimals,
    setTxSnackbarMessage,
    setTxSnackbarOpen
  ) => {
    let parameters = [];
    let options = {
      network: chainIdToName[parseInt(library.provider.chainId)],
      provider: library.provider,
      gasLimit,
      gasPrice: gasPrice.toString(),
    };

    if (underlyingAddress === ethDummyAddress) {
      options.value = eX(amount, 18).toString();
      options.abi = compoundConstants.abi.cEther;
    } else {
      parameters.push(eX(amount, decimals).toString());
      options.abi = compoundConstants.abi.cErc20;
    }

    try {
      const tx = await Compound.eth.trx(
        pTokenAddress,
        "repayBorrow",
        parameters, // [optional] parameters
        options // [optional] call options, provider, network, ethers.js "overrides"
      );
      console.log("tx", JSON.stringify(tx));
      setTxSnackbarMessage(`Transaction sent: ${tx.hash}`);
    } catch (e) {
      setTxSnackbarMessage("Error occurred!");
    }

    setTxSnackbarOpen(true);
  };

  const handleEnterMarket = async (
    pTokenAddress,
    setTxSnackbarMessage,
    setTxSnackbarOpen
  ) => {
    try {
      const tx = await Compound.eth.trx(
        generalDetails.comptrollerAddress,
        "enterMarkets",
        [[pTokenAddress]], // [optional] parameters
        {
          network: chainIdToName[parseInt(library.provider.chainId)],
          provider: library.provider,
          gasLimitEnterMarket,
          gasPrice: gasPrice.toString(),
          abi: compoundConstants.abi.Comptroller,
        } // [optional] call options, provider, network, ethers.js "overrides"
      );
      console.log("tx", JSON.stringify(tx));
      setTxSnackbarMessage(`Transaction sent: ${tx.hash}`);
    } catch (e) {
      setTxSnackbarMessage("Error occurred!");
    }

    setTxSnackbarOpen(true);
  };

  const handleExitMarket = async (
    pTokenAddress,
    setTxSnackbarMessage,
    setTxSnackbarOpen
  ) => {
    try {
      const tx = await Compound.eth.trx(
        generalDetails.comptrollerAddress,
        "exitMarket",
        [pTokenAddress], // [optional] parameters
        {
          network: chainIdToName[parseInt(library.provider.chainId)],
          provider: library.provider,
          gasLimitEnterMarket,
          gasPrice: gasPrice.toString(),
          abi: compoundConstants.abi.Comptroller,
        } // [optional] call options, provider, network, ethers.js "overrides"
      );
      console.log("tx", JSON.stringify(tx));
      setTxSnackbarMessage(`Transaction sent: ${tx.hash}`);
    } catch (e) {
      setTxSnackbarMessage("Error occurred!");
    }

    setTxSnackbarOpen(true);
  };

  const updateGasPrice = async () => {
    const response = await fetch(
      "https://ethgasstation.info/api/ethgasAPI.json"
    );
    const data = await response.json();
    setGasPrice(eX(data.fast, 8));
  };

  const getMaxAmount = (symbol, walletBalance) => {
    if (symbol === "ETH") {
      return walletBalance.minus(eX(gasPrice.times(gasLimit), -18));
    } else {
      return walletBalance;
    }
  };

  const StyledSwitch = withStyles({
    switchBase: {
      "&$checked": {
        color: "#40c4ff",
      },
      "&$checked + $track": {
        backgroundColor: "#40c4ff",
      },
    },
    checked: {},
    track: {},
  })(Switch);

  const SupplyMarketRow = (props) => {
    return (
      <tr
        style={{ cursor: "pointer" }}
        onClick={() => {
          setSupplyDialogOpen(true);
          setSelectedMarketDetails(props.details);
        }}
      >
        <td>
          <img
            className="rounded-circle"
            style={{ width: "40px" }}
            src={require(`../../assets/images/${props.details.symbol}-logo.png`)}
            alt="activity-user"
          />
        </td>
        <td>
          <h6 className="mb-1">{props.details.symbol}</h6>
        </td>
        <td>
          <h6 className="text-muted">
            {`${props.details.supplyApy?.toFixed(2)}%`}
          </h6>
        </td>
        <td>
          <h6 className="text-muted">
            <i
              className={`fa fa-circle${
                roundToDecimalPlaces(props.details.walletBalance, 4) <= 0
                  ? "-o"
                  : ""
              } text-c-green f-10 m-r-15`}
            />
            {roundToDecimalPlaces(props.details.walletBalance, 4)}
          </h6>
        </td>
        <td>
          <StyledSwitch
            checked={props.details.isEnterMarket}
            onChange={() => {
              setSupplyDialogOpen(false);
              setEnterMarketDialogOpen(true);
              setSelectedMarketDetails(props.details);
            }}
          />
        </td>
      </tr>
    );
  };

  const BorrowMarketRow = (props) => {
    return (
      <tr
        style={{ cursor: "pointer" }}
        onClick={() => {
          setBorrowDialogOpen(true);
          setSelectedMarketDetails(props.details);
        }}
      >
        <td>
          <img
            className="rounded-circle"
            style={{ width: "40px" }}
            src={require(`../../assets/images/${props.details.symbol}-logo.png`)}
            alt="activity-user"
          />
        </td>
        <td>
          <h6 className="mb-1">{props.details.symbol}</h6>
        </td>
        <td>
          <h6 className="text-muted">
            {`${props.details.borrowApy?.toFixed(2)}%`}
          </h6>
        </td>
        <td>
          <h6 className="text-muted">
            {roundToDecimalPlaces(props.details.walletBalance, 4)}
          </h6>
        </td>
        <td>
          <h6 className="text-muted">{`$${convertToLargeNumberRepresentation(
            new BigNumber(props.details.liquidity).precision(4)
          )}`}</h6>
        </td>
      </tr>
    );
  };

  const BlueStyledTabs = withStyles({
    indicator: {
      backgroundColor: "#40c4ff",
    },
  })(Tabs);

  const TabPanel = (props) => {
    const { children, value, index, ...other } = props;

    return (
      <div hidden={value !== index} {...other}>
        {value === index && (
          <Box style={{ padding: "20px 0px 0px 0px" }}>
            <div>{children}</div>
          </Box>
        )}
      </div>
    );
  };

  const DialogSupplyRatesSection = (props) => {
    return (
      <div>
        <ListSubheader style={{ fontSize: "80%", fontWeight: "bold" }}>
          Supply Rate
        </ListSubheader>
        <ListItem>
          <img
            className="rounded-circle"
            style={{ width: "30px", margin: "0px 10px 0px 0px" }}
            src={require(`../../assets/images/${props.selectedMarketDetails.symbol}-logo.png`)}
            alt="activity-user"
          />
          <ListItemText secondary={`Supply APY`} />
          <ListItemSecondaryAction
            style={{ margin: "0px 15px 0px 0px" }}
          >{`${props.selectedMarketDetails.supplyApy?.toFixed(
            2
          )}%`}</ListItemSecondaryAction>
        </ListItem>
      </div>
    );
  };

  const DialogBorrowLimitSection = (props) => {
    return (
      <div>
        <ListSubheader style={{ fontSize: "80%", fontWeight: "bold" }}>
          Borrow Limit
        </ListSubheader>
        <ListItem>
          <ListItemText secondary={`Borrow Limit`} />
          <ListItemSecondaryAction
            style={{ margin: "0px 15px 0px 0px" }}
          >{`$${props.generalDetails.totalBorrowLimit?.toFixed(
            2
          )}`}</ListItemSecondaryAction>
        </ListItem>
        <ListItem>
          <ListItemText secondary={`Borrow Limit Used`} />
          <ListItemSecondaryAction
            style={{ margin: "0px 15px 0px 0px" }}
          >{`${zeroStringIfNullish(
            props.generalDetails.totalBorrowLimitUsedPercent?.toFixed(2),
            2
          )}%`}</ListItemSecondaryAction>
        </ListItem>
      </div>
    );
  };

  const DialogBorrowRatesSection = (props) => {
    return (
      <div>
        <ListSubheader style={{ fontSize: "80%", fontWeight: "bold" }}>
          Borrow Rate
        </ListSubheader>
        <ListItem>
          <img
            className="rounded-circle"
            style={{ width: "30px", margin: "0px 10px 0px 0px" }}
            src={require(`../../assets/images/${props.selectedMarketDetails.symbol}-logo.png`)}
            alt="activity-user"
          />
          <ListItemText secondary={`Borrow APY`} />
          <ListItemSecondaryAction
            style={{ margin: "0px 15px 0px 0px" }}
          >{`${props.selectedMarketDetails.borrowApy?.toFixed(
            2
          )}%`}</ListItemSecondaryAction>
        </ListItem>
      </div>
    );
  };

  const DialogBorrowLimitSection2 = (props) => {
    return (
      <div>
        <ListSubheader style={{ fontSize: "80%", fontWeight: "bold" }}>
          Borrow Limit
        </ListSubheader>
        <ListItem>
          <ListItemText secondary={`Borrow Balance`} />
          <ListItemSecondaryAction
            style={{ margin: "0px 15px 0px 0px" }}
          >{`$${props.generalDetails.totalBorrowBalance?.toFixed(
            2
          )}`}</ListItemSecondaryAction>
        </ListItem>
        <ListItem>
          <ListItemText secondary={`Borrow Limit Used`} />
          <ListItemSecondaryAction
            style={{ margin: "0px 15px 0px 0px" }}
          >{`${zeroStringIfNullish(
            props.generalDetails.totalBorrowLimitUsedPercent?.toFixed(2),
            2
          )}%`}</ListItemSecondaryAction>
        </ListItem>
      </div>
    );
  };

  const WarningDialog = (props) => {
    return (
      <Dialog
        open={warningDialogOpen}
        onClose={() => setWarningDialogOpen(false)}
      >
        <DialogTitle style={{ padding: "50px 100px 10px 100px" }}>
          Wrong Network Detected
        </DialogTitle>
        <DialogContent style={{ padding: "10px 100px 50px 100px" }}>
          Please switch to Kovan testnet
        </DialogContent>
      </Dialog>
    );
  };

  const SupplyDialog = (props) => {
    const [tabValue, setTabValue] = useState(0);
    const [supplyAmount, setSupplyAmount] = useState("");
    const [withdrawAmount, setWithdrawAmount] = useState("");
    const [supplyValidationMessage, setSupplyValidationMessage] = useState("");
    const [withdrawValidationMessage, setWithdrawValidationMessage] = useState(
      ""
    );
    const [txSnackbarOpen, setTxSnackbarOpen] = useState(false);
    const [txSnackbarMessage, setTxSnackbarMessage] = useState("");

    const handleTabChange = (event, newValue) => {
      setTabValue(newValue);
    };
    const handleSupplyAmountChange = (event) => {
      const amount = event.target.value;
      setSupplyAmount(amount);

      if (amount <= 0) {
        setSupplyValidationMessage("Amount must be > 0");
      } else if (amount > +props.selectedMarketDetails.walletBalance) {
        setSupplyValidationMessage("Amount must be <= balance");
      } else {
        setSupplyValidationMessage("");
      }
    };
    const handleWithdrawAmountChange = (event) => {
      const amount = event.target.value;
      setWithdrawAmount(amount);

      if (amount <= 0) {
        setWithdrawValidationMessage("Amount must be > 0");
      } else if (
        amount > +props.selectedMarketDetails.supplyBalanceInTokenUnit
      ) {
        setWithdrawValidationMessage("Amount must be <= protocol balance");
      } else if (amount > +props.selectedMarketDetails.underlyingAmount) {
        setWithdrawValidationMessage("Amount must be <= liquidity");
      } else {
        setWithdrawValidationMessage("");
      }
    };

    return (
      <Dialog
        open={supplyDialogOpen}
        onClose={() => setSupplyDialogOpen(false)}
      >
        <DialogTitle>
          {props.selectedMarketDetails.symbol && (
            <img
              className="rounded-circle"
              style={{ width: "30px", margin: "0px 10px 0px 0px" }}
              src={require(`../../assets/images/${props.selectedMarketDetails.symbol}-logo.png`)}
              alt="activity-user"
            />
          )}
          {`${props.selectedMarketDetails.symbol}`}
        </DialogTitle>
        <DialogContent>
          <AppBar position="static" color="inherit" elevation={0}>
            <BlueStyledTabs
              value={tabValue}
              onChange={handleTabChange}
              textColor="inherit"
              variant="fullWidth"
            >
              <Tab label="Supply" style={{ outline: "none" }} />
              <Tab label="Withdraw" style={{ outline: "none" }} />
            </BlueStyledTabs>
          </AppBar>
          {props.selectedMarketDetails.symbol && (
            <div>
              <TabPanel value={tabValue} index={0}>
                <TextField
                  fullWidth
                  variant="outlined"
                  label={props.selectedMarketDetails.symbol}
                  value={supplyAmount}
                  onChange={handleSupplyAmountChange}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment
                        position="end"
                        onClick={() => {
                          setSupplyAmount(
                            getMaxAmount(
                              props.selectedMarketDetails.symbol,
                              props.selectedMarketDetails.walletBalance
                            ).toString()
                          );
                          setSupplyValidationMessage("");
                        }}
                      >
                        Max
                      </InputAdornment>
                    ),
                  }}
                />
                <div style={{ height: "30px", color: "red" }}>
                  {supplyValidationMessage}
                </div>
                <List>
                  <DialogSupplyRatesSection
                    selectedMarketDetails={props.selectedMarketDetails}
                  />
                  <br />
                  <DialogBorrowLimitSection
                    generalDetails={props.generalDetails}
                  />
                  <br />
                  <br />
                  <ListItem>
                    {props.selectedMarketDetails.underlyingAllowance?.isGreaterThan(
                      0
                    ) &&
                    props.selectedMarketDetails.underlyingAllowance?.isGreaterThanOrEqualTo(
                      +supplyAmount
                    ) ? (
                      <Button
                        variant="primary"
                        size="lg"
                        disabled={!supplyAmount || supplyValidationMessage}
                        block
                        onClick={() => {
                          handleSupply(
                            props.selectedMarketDetails.underlyingAddress,
                            props.selectedMarketDetails.pTokenAddress,
                            supplyAmount,
                            props.selectedMarketDetails.decimals,
                            setTxSnackbarMessage,
                            setTxSnackbarOpen
                          );
                        }}
                      >
                        Supply
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="lg"
                        block
                        onClick={() => {
                          handleEnable(
                            props.selectedMarketDetails.underlyingAddress,
                            props.selectedMarketDetails.pTokenAddress,
                            setTxSnackbarMessage,
                            setTxSnackbarOpen
                          );
                        }}
                      >
                        Enable
                      </Button>
                    )}
                  </ListItem>
                </List>
                <List>
                  <ListItem>
                    <ListItemText secondary={`Wallet Balance`} />
                    <ListItemSecondaryAction
                      style={{ margin: "0px 15px 0px 0px" }}
                    >{`${roundToDecimalPlaces(
                      props.selectedMarketDetails.walletBalance,
                      4
                    )} ${
                      props.selectedMarketDetails.symbol
                    }`}</ListItemSecondaryAction>
                  </ListItem>
                </List>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <TextField
                  fullWidth
                  variant="outlined"
                  label={props.selectedMarketDetails.symbol}
                  value={withdrawAmount}
                  onChange={handleWithdrawAmountChange}
                  // InputProps={{
                  //   endAdornment: (
                  //     <InputAdornment
                  //       position="end"
                  //       onClick={() => {
                  //         setWithdrawAmount(
                  //           getMaxAmount(
                  //             props.selectedMarketDetails.symbol,
                  //             props.selectedMarketDetails.walletBalance
                  //           ).toString()
                  //         );
                  //       }}
                  //     >
                  //       Max
                  //     </InputAdornment>
                  //   ),
                  // }}
                />
                <div style={{ height: "30px", color: "red" }}>
                  {withdrawValidationMessage}
                </div>
                <List>
                  <DialogSupplyRatesSection
                    selectedMarketDetails={props.selectedMarketDetails}
                  />
                  <br />
                  <DialogBorrowLimitSection
                    generalDetails={props.generalDetails}
                  />
                  <br />
                  <br />
                  <ListItem>
                    <Button
                      variant="primary"
                      size="lg"
                      disabled={!withdrawAmount || withdrawValidationMessage}
                      block
                      onClick={() => {
                        handleWithdraw(
                          props.selectedMarketDetails.underlyingAddress,
                          props.selectedMarketDetails.pTokenAddress,
                          withdrawAmount,
                          props.selectedMarketDetails.decimals,
                          setTxSnackbarMessage,
                          setTxSnackbarOpen
                        );
                      }}
                    >
                      Withdraw
                    </Button>
                  </ListItem>
                </List>
                <List>
                  <ListItem>
                    <ListItemText secondary={`Protocol Balance`} />
                    <ListItemSecondaryAction
                      style={{ margin: "0px 15px 0px 0px" }}
                    >{`${roundToDecimalPlaces(
                      props.selectedMarketDetails.supplyBalanceInTokenUnit,
                      4
                    )} ${
                      props.selectedMarketDetails.symbol
                    }`}</ListItemSecondaryAction>
                  </ListItem>
                </List>
              </TabPanel>
            </div>
          )}
        </DialogContent>
        <TxSnackbar
          open={txSnackbarOpen}
          message={txSnackbarMessage}
          onClose={(event, reason) => {
            if (reason === "clickaway") {
              return;
            }
            setTxSnackbarOpen(false);
          }}
        />
      </Dialog>
    );
  };

  const BorrowDialog = (props) => {
    const [tabValue, setTabValue] = useState(0);
    const [borrowAmount, setBorrowAmount] = useState("");
    const [repayAmount, setRepayAmount] = useState("");
    const [borrowValidationMessage, setBorrowValidationMessage] = useState("");
    const [repayValidationMessage, setRepayValidationMessage] = useState("");
    const [txSnackbarOpen, setTxSnackbarOpen] = useState(false);
    const [txSnackbarMessage, setTxSnackbarMessage] = useState("");

    const handleTabChange = (event, newValue) => {
      setTabValue(newValue);
    };
    const handleBorrowAmountChange = (event) => {
      const amount = event.target.value;
      setBorrowAmount(amount);

      if (amount <= 0) {
        setBorrowValidationMessage("Amount must be > 0");
      } else if (
        amount * +props.selectedMarketDetails.underlyingPrice >
        +props.generalDetails.totalBorrowLimit
      ) {
        setBorrowValidationMessage("Amount must be <= borrow limit");
      } else if (amount > +props.selectedMarketDetails.underlyingAmount) {
        setBorrowValidationMessage("Amount must be <= liquidity");
      } else {
        setBorrowValidationMessage("");
      }
    };
    const handleRepayAmountChange = (event) => {
      const amount = event.target.value;
      setRepayAmount(amount);

      if (amount <= 0) {
        setRepayValidationMessage("Amount must be > 0");
      } else if (
        amount > +props.selectedMarketDetails.borrowBalanceInTokenUnit
      ) {
        setRepayValidationMessage("Amount must be <= protocol balance");
      } else if (amount > +props.selectedMarketDetails.walletBalance) {
        setRepayValidationMessage("Amount must be <= balance");
      } else {
        setRepayValidationMessage("");
      }
    };

    return (
      <Dialog
        open={borrowDialogOpen}
        onClose={() => setBorrowDialogOpen(false)}
      >
        <DialogTitle>
          {props.selectedMarketDetails.symbol && (
            <img
              className="rounded-circle"
              style={{ width: "30px", margin: "0px 10px 0px 0px" }}
              src={require(`../../assets/images/${props.selectedMarketDetails.symbol}-logo.png`)}
              alt="activity-user"
            />
          )}
          {`${props.selectedMarketDetails.symbol}`}
        </DialogTitle>
        <DialogContent>
          <AppBar position="static" color="inherit" elevation={0}>
            <BlueStyledTabs
              value={tabValue}
              onChange={handleTabChange}
              textColor="inherit"
              variant="fullWidth"
            >
              <Tab label="Borrow" style={{ outline: "none" }} />
              <Tab label="Repay" style={{ outline: "none" }} />
            </BlueStyledTabs>
          </AppBar>
          {props.selectedMarketDetails.symbol && (
            <div>
              <TabPanel value={tabValue} index={0}>
                <TextField
                  fullWidth
                  variant="outlined"
                  label={props.selectedMarketDetails.symbol}
                  value={borrowAmount}
                  onChange={handleBorrowAmountChange}
                  // InputProps={{
                  //   endAdornment: (
                  //     <InputAdornment
                  //       position="end"
                  //       onClick={() => {
                  //         setBorrowAmount(
                  //           getMaxAmount(
                  //             props.selectedMarketDetails.symbol,
                  //             props.selectedMarketDetails.walletBalance
                  //           ).toString()
                  //         );
                  //       }}
                  //     >
                  //       Max
                  //     </InputAdornment>
                  //   ),
                  // }}
                />
                <div style={{ height: "30px", color: "red" }}>
                  {borrowValidationMessage}
                </div>
                <List>
                  <DialogBorrowRatesSection
                    selectedMarketDetails={props.selectedMarketDetails}
                  />
                  <br />
                  <DialogBorrowLimitSection2
                    generalDetails={props.generalDetails}
                  />
                  <br />
                  <br />
                  <ListItem>
                    <Button
                      variant="primary"
                      size="lg"
                      disabled={!borrowAmount || borrowValidationMessage}
                      block
                      onClick={() => {
                        handleBorrow(
                          props.selectedMarketDetails.underlyingAddress,
                          props.selectedMarketDetails.pTokenAddress,
                          borrowAmount,
                          props.selectedMarketDetails.decimals,
                          setTxSnackbarMessage,
                          setTxSnackbarOpen
                        );
                      }}
                    >
                      Borrow
                    </Button>
                  </ListItem>
                </List>
                <List>
                  <ListItem>
                    <ListItemText secondary={`Protocol Balance`} />
                    <ListItemSecondaryAction
                      style={{ margin: "0px 15px 0px 0px" }}
                    >{`${roundToDecimalPlaces(
                      props.selectedMarketDetails.borrowBalanceInTokenUnit,
                      4
                    )} ${
                      props.selectedMarketDetails.symbol
                    }`}</ListItemSecondaryAction>
                  </ListItem>
                </List>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <TextField
                  fullWidth
                  variant="outlined"
                  label={props.selectedMarketDetails.symbol}
                  value={repayAmount}
                  onChange={handleRepayAmountChange}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment
                        position="end"
                        onClick={() => {
                          setRepayAmount(
                            getMaxAmount(
                              props.selectedMarketDetails.symbol,
                              props.selectedMarketDetails.walletBalance
                            ).toString()
                          );
                          setRepayValidationMessage("");
                        }}
                      >
                        Max
                      </InputAdornment>
                    ),
                  }}
                />
                <div style={{ height: "30px", color: "red" }}>
                  {repayValidationMessage}
                </div>
                <List>
                  <DialogBorrowRatesSection
                    selectedMarketDetails={props.selectedMarketDetails}
                  />
                  <br />
                  <DialogBorrowLimitSection2
                    generalDetails={props.generalDetails}
                  />
                  <br />
                  <br />
                  <ListItem>
                    {props.selectedMarketDetails.underlyingAllowance?.isGreaterThan(
                      0
                    ) &&
                    props.selectedMarketDetails.underlyingAllowance?.isGreaterThanOrEqualTo(
                      +repayAmount
                    ) ? (
                      <Button
                        variant="primary"
                        size="lg"
                        disabled={!repayAmount || repayValidationMessage}
                        block
                        onClick={() => {
                          handleRepay(
                            props.selectedMarketDetails.underlyingAddress,
                            props.selectedMarketDetails.pTokenAddress,
                            repayAmount,
                            props.selectedMarketDetails.decimals,
                            setTxSnackbarMessage,
                            setTxSnackbarOpen
                          );
                        }}
                      >
                        Repay
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="lg"
                        block
                        onClick={() => {
                          handleEnable(
                            props.selectedMarketDetails.underlyingAddress,
                            props.selectedMarketDetails.pTokenAddress,
                            setTxSnackbarMessage,
                            setTxSnackbarOpen
                          );
                        }}
                      >
                        Enable
                      </Button>
                    )}
                  </ListItem>
                </List>
                <List>
                  <ListItem>
                    <ListItemText secondary={`Wallet Balance`} />
                    <ListItemSecondaryAction
                      style={{ margin: "0px 15px 0px 0px" }}
                    >{`${roundToDecimalPlaces(
                      props.selectedMarketDetails.walletBalance,
                      4
                    )} ${
                      props.selectedMarketDetails.symbol
                    }`}</ListItemSecondaryAction>
                  </ListItem>
                </List>
              </TabPanel>
            </div>
          )}
        </DialogContent>
        <TxSnackbar
          open={txSnackbarOpen}
          message={txSnackbarMessage}
          onClose={(event, reason) => {
            if (reason === "clickaway") {
              return;
            }
            setTxSnackbarOpen(false);
          }}
        />
      </Dialog>
    );
  };

  const EnterMarketDialog = (props) => {
    const [txSnackbarOpen, setTxSnackbarOpen] = useState(false);
    const [txSnackbarMessage, setTxSnackbarMessage] = useState("");

    return (
      <Dialog
        open={enterMarketDialogOpen}
        onClose={() => setEnterMarketDialogOpen(false)}
      >
        <DialogTitle>
          {props.selectedMarketDetails.symbol && (
            <img
              className="rounded-circle"
              style={{ width: "30px", margin: "0px 10px 0px 0px" }}
              src={require(`../../assets/images/${props.selectedMarketDetails.symbol}-logo.png`)}
              alt="activity-user"
            />
          )}
          {`${
            props.selectedMarketDetails.isEnterMarket ? "Disable" : "Enable"
          } as Collateral`}
        </DialogTitle>
        <DialogContent>
          {props.selectedMarketDetails.symbol && (
            <List>
              <br />
              <ListItem>
                {props.selectedMarketDetails.isEnterMarket ? (
                  <Typography>
                    This asset is required to support your borrowed assets.
                    Either repay borrowed assets, or supply another asset as
                    collateral.
                  </Typography>
                ) : (
                  <Typography>
                    Each asset used as collateral increases your borrowing
                    limit. Be careful, this can subject the asset to being
                    seized in liquidation.
                  </Typography>
                )}
              </ListItem>
              <DialogBorrowLimitSection generalDetails={props.generalDetails} />
              <br />
              <br />
              <ListItem>
                {props.selectedMarketDetails.isEnterMarket ? (
                  <Button
                    variant="primary"
                    size="lg"
                    block
                    onClick={() => {
                      handleExitMarket(
                        props.selectedMarketDetails.pTokenAddress,
                        setTxSnackbarMessage,
                        setTxSnackbarOpen
                      );
                    }}
                  >
                    {`Disable ${props.selectedMarketDetails.symbol} as Collateral`}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="lg"
                    block
                    onClick={() => {
                      handleEnterMarket(
                        props.selectedMarketDetails.pTokenAddress,
                        setTxSnackbarMessage,
                        setTxSnackbarOpen
                      );
                    }}
                  >
                    {`Use ${props.selectedMarketDetails.symbol} as Collateral`}
                  </Button>
                )}
              </ListItem>
            </List>
          )}
        </DialogContent>
        <TxSnackbar
          open={txSnackbarOpen}
          message={txSnackbarMessage}
          onClose={(event, reason) => {
            if (reason === "clickaway") {
              return;
            }
            setTxSnackbarOpen(false);
          }}
        />
      </Dialog>
    );
  };

  const TxSnackbar = (props) => {
    return (
      <Snackbar
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        open={props.open}
        autoHideDuration={5000}
        onClose={props.onClose}
        message={props.message}
        action={null}
      />
    );
  };

  return (
    <Aux>
      <WarningDialog />
      <SupplyDialog
        open={supplyDialogOpen}
        selectedMarketDetails={selectedMarketDetails}
        generalDetails={generalDetails}
      />
      <BorrowDialog
        open={borrowDialogOpen}
        selectedMarketDetails={selectedMarketDetails}
        generalDetails={generalDetails}
      />
      <EnterMarketDialog
        open={enterMarketDialogOpen}
        selectedMarketDetails={selectedMarketDetails}
        generalDetails={generalDetails}
      />
      <LinearProgress
        style={{
          visibility: generalDetails.netApy ? "hidden" : "visible",
          margin: "0px 0px 8px 0px",
        }}
      />
      <Row>
        <Col xs={12} md={6}>
          <Card>
            <Card.Body className="border-bottom">
              <h6 className="mb-4">Supply Balance</h6>
              <div className="row d-flex align-items-center">
                <div className="col-12">
                  <h3 className="f-w-300 d-flex align-items-center m-b-0">
                    <i className={`fa fa-circle text-c-green f-10 m-r-15`} />
                    {`$${zeroStringIfNullish(
                      generalDetails.totalSupplyBalance?.toFixed(2),
                      2
                    )}`}
                  </h3>
                </div>
              </div>
            </Card.Body>
            <Card.Body>
              <h6 className="mb-4">Net APY</h6>
              <div className="row d-flex align-items-center">
                <div className="col-12">
                  <h3 className="f-w-300 d-flex align-items-center m-b-0">
                    <i className={`fa fa-circle text-c-green f-10 m-r-15`} />
                    {`${zeroStringIfNullish(
                      generalDetails.netApy?.toFixed(2),
                      2
                    )}%`}
                  </h3>
                </div>
              </div>
              <div className="progress m-t-30" style={{ height: "7px" }}>
                <div
                  className="progress-bar progress-c-theme"
                  role="progressbar"
                  style={{
                    width: `${
                      generalDetails.yearBorrowInterest
                        ?.div(generalDetails.yearSupplyInterest)
                        .times(-1)
                        .plus(1)
                        .times(100)
                        .toString() || 0
                    }%`,
                  }}
                  aria-valuenow="50"
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Card.Body className="border-bottom">
              <h6 className="mb-4">Borrow Balance</h6>
              <div className="row d-flex align-items-center">
                <div className="col-12">
                  <h3 className="f-w-300 d-flex align-items-center m-b-0">
                    <i className={`fa fa-circle text-c-yellow f-10 m-r-15`} />
                    {`$${zeroStringIfNullish(
                      generalDetails.totalBorrowBalance?.toFixed(2),
                      2
                    )}`}
                  </h3>
                </div>
              </div>
            </Card.Body>
            <Card.Body>
              <h6 className="mb-4">Borrow Limit</h6>
              <div className="row d-flex align-items-center">
                <div className="col-6">
                  <h3 className="f-w-300 d-flex align-items-center m-b-0">
                    <i className={`fa fa-circle text-c-yellow f-10 m-r-15`} />
                    {`$${zeroStringIfNullish(
                      generalDetails.totalBorrowLimit?.toFixed(2),
                      2
                    )}`}
                  </h3>
                </div>
                <div className="col-6 text-right">
                  <p className="m-b-0">{`${zeroStringIfNullish(
                    generalDetails.totalBorrowLimitUsedPercent?.toFixed(2),
                    2
                  )}% Used`}</p>
                </div>
              </div>
              <div className="progress m-t-30" style={{ height: "7px" }}>
                <div
                  className="progress-bar progress-c-theme2"
                  role="progressbar"
                  style={{
                    width: `${generalDetails.totalBorrowLimitUsedPercent?.toString()}%`,
                  }}
                  aria-valuenow="35"
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Row>
        <Col xs={12} md={6}>
          <Card className="Recent-Users">
            <Card.Header style={{ borderBottom: "none" }}>
              <Card.Title as="h5">Supply Markets</Card.Title>
            </Card.Header>
            <Card.Body className="px-0 py-2">
              <Table responsive hover style={{ marginBottom: "0px" }}>
                <tbody>
                  <tr>
                    <th>Asset</th>
                    <th></th>
                    <th>APY</th>
                    <th>Wallet</th>
                    <th>Collateral</th>
                  </tr>
                  {generalDetails.totalSupplyBalance?.toNumber() > 0 && (
                    <tr>
                      <td
                        style={{
                          fontSize: "80%",
                          fontWeight: "bold",
                          padding: "1px 0px 1px 15px",
                        }}
                      >
                        Supplying
                      </td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  )}
                  {allMarketDetails
                    .filter((item) => item.supplyBalance?.toNumber() > 0)
                    .map((details, index) => (
                      <SupplyMarketRow key={index} details={details} />
                    ))}
                  {generalDetails.totalSupplyBalance?.toNumber() > 0 && (
                    <tr>
                      <td
                        style={{
                          fontSize: "80%",
                          fontWeight: "bold",
                          padding: "1px 0px 1px 15px",
                        }}
                      >
                        Other Markets
                      </td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  )}
                  {allMarketDetails
                    .filter((item) => item.supplyBalance?.toNumber() <= 0)
                    .map((details, index) => (
                      <SupplyMarketRow key={index} details={details} />
                    ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="Recent-Users">
            <Card.Header style={{ borderBottom: "none" }}>
              <Card.Title as="h5">Borrow Markets</Card.Title>
            </Card.Header>
            <Card.Body className="px-0 py-2">
              <Table responsive hover style={{ marginBottom: "0px" }}>
                <tbody>
                  <tr>
                    <th>Asset</th>
                    <th></th>
                    <th>APY</th>
                    <th>Wallet</th>
                    <th>Liquidity</th>
                  </tr>
                  {generalDetails.totalBorrowBalance?.toNumber() > 0 && (
                    <tr>
                      <td
                        style={{
                          fontSize: "80%",
                          fontWeight: "bold",
                          padding: "1px 0px 1px 15px",
                        }}
                      >
                        Borrowing
                      </td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  )}
                  {allMarketDetails
                    .filter((item) => item.borrowBalance?.toNumber() > 0)
                    .map((details, index) => (
                      <BorrowMarketRow key={index} details={details} />
                    ))}
                  {generalDetails.totalBorrowBalance?.toNumber() > 0 && (
                    <tr>
                      <td
                        style={{
                          fontSize: "80%",
                          fontWeight: "bold",
                          padding: "1px 0px 1px 15px",
                        }}
                      >
                        Other Markets
                      </td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  )}
                  {allMarketDetails
                    .filter((item) => item.borrowBalance?.toNumber() <= 0)
                    .map((details, index) => (
                      <BorrowMarketRow key={index} details={details} />
                    ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Aux>
  );
}

export default Dashboard;
