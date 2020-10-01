import React, { useEffect, useState, useContext } from "react";
import { Route, Link } from "react-router-dom";

import routes from "../../../routes";
import Aux from "../../../hoc/_Aux";
import { Row, Col, Navbar, Nav, Button, Dropdown } from "react-bootstrap";
import Snackbar from "@material-ui/core/Snackbar";
import { store } from "../../../store";

import "./app.scss";

import { injected } from "../../../connectors";
import { useEagerConnect, useInactiveListener } from "../../../hooks";
import { useWeb3React } from "@web3-react/core";

import { chainIdToName } from "../../../constants";
import {
  roundToDecimalPlaces,
  zeroStringIfNullish,
  eX,
} from "../../../helpers";
const Compound = require("@compound-finance/compound-js/dist/nodejs/src/index.js");
// const compoundConstants = require("@compound-finance/compound-js/dist/nodejs/src/constants.js");

function AdminLayout() {
  const { state: globalState } = useContext(store);
  const triedEager = useEagerConnect();
  const { account, library, activate, deactivate, active } = useWeb3React();
  const [pctEarned, setPctEarned] = useState("");
  const [pctBalance, setPctBalance] = useState("");
  const [otherSnackbarOpen, setOtherSnackbarOpen] = useState(false);
  const [otherSnackbarMessage, setOtherSnackbarMessage] = useState("");
  const gasLimitClaim = "1182020";

  useInactiveListener(!triedEager);

  useEffect(() => {
    (async () => {
      setPctEarned(await getPctEarned(account));
      setPctBalance(await getPctBalance(account));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library, account]);

  function ConnectButton() {

    const onConnectClick = () => {
      activate(injected);
    };

    return (
      <div>
        {active ? (
          <Dropdown>
            <Dropdown.Toggle variant="outline-secondary">
              {getShortenAddress(account)}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => deactivate()}>
                Disconnect
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        ) : (
            <Button onClick={onConnectClick} variant="outline-secondary">
              Connect
            </Button>
          )}
      </div>
    );
  }

  function getShortenAddress(address) {
    const firstCharacters = address.substring(0, 6);
    const lastCharacters = address.substring(
      address.length - 4,
      address.length
    );
    return `${firstCharacters}...${lastCharacters}`;
  }

  function PctButton() {
    return (
      <Dropdown alignRight>
        <Dropdown.Toggle variant="outline-secondary">
          <img
            className="rounded-circle"
            style={{ width: "16px", margin: "0px 10px 3px 0px" }}
            src={require(`../../../assets/images/PCT-logo.png`)}
            alt=""
          />
          {`${roundToDecimalPlaces(zeroStringIfNullish(pctBalance), 4)}`}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item style={{ cursor: "default", padding: "20px 20px 20px 20px" }}>
            <span>
              <span style={{ color: "grey", margin: "0px 10px 0px 0px" }}>PCT Balance</span>
              {`${roundToDecimalPlaces(zeroStringIfNullish(pctBalance), 4)}`}
            </span>
          </Dropdown.Item>
          <Dropdown.Item style={{ cursor: "default", padding: "12px 20px 12px 20px" }}>
            <span>
              <span style={{ color: "grey", margin: "0px 10px 0px 0px" }}>PCT Earned</span>
              {`${roundToDecimalPlaces(zeroStringIfNullish(pctEarned), 4)}`}
            </span>
            <Button style={{ margin: "0px 0px 0px 60px" }} onClick={() => { claimPct(account) }}>Collect</Button>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    );
  }

  const getPctBalance = async (walletAddress) => {
    if (library) {
      const balance = await Compound.eth.read(
        process.env.REACT_APP_PCT_ADDRESS,
        "function balanceOf(address) returns (uint)",
        [walletAddress], // [optional] parameters
        {
          network: chainIdToName[parseInt(library.provider.chainId)],
          _compoundProvider: library,
        } // [optional] call options, provider, network, ethers.js "overrides"
      );

      return eX(balance.toString(), -18).toString();
    }
  };

  const getPctEarned = async (walletAddress) => {
    if (library) {
      const compBalanceMetadata = await Compound.eth.read(
        process.env.REACT_APP_COMPOUND_LENS_ADDRESS,
        "function getCompBalanceMetadataExt(address, address, address) returns (uint, uint, address, uint)",
        [process.env.REACT_APP_PCT_ADDRESS, process.env.REACT_APP_COMPTROLLER_ADDRESS, walletAddress], // [optional] parameters
        {
          network: chainIdToName[parseInt(library.provider.chainId)],
          _compoundProvider: library,
        } // [optional] call options, provider, network, ethers.js "overrides"
      );

      return eX(compBalanceMetadata[3].toString(), -18).toString();
    }
  };

  const claimPct = async (walletAddress) => {
    console.log("globalState.gasPrice.toString()", globalState.gasPrice.toString())
    let parameters = [walletAddress];
    let options = {
      network: chainIdToName[parseInt(library.provider.chainId)],
      provider: library.provider,
      gasLimit: gasLimitClaim,
      gasPrice: globalState.gasPrice.toString(),
      // abi: compoundConstants.abi.Comptroller,
    };

    try {
      const tx = await Compound.eth.trx(
        process.env.REACT_APP_COMPTROLLER_ADDRESS,
        { "constant": false, "inputs": [{ "internalType": "address", "name": "holder", "type": "address" }], "name": "claimComp", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function", "signature": "0xe9af0292" },
        parameters, // [optional] parameters
        options // [optional] call options, provider, network, ethers.js "overrides"
      );
      console.log("tx", JSON.stringify(tx));
      setOtherSnackbarMessage(`Transaction sent: ${tx.hash}`);
    } catch (e) {
      console.log("tx error:", e);
      setOtherSnackbarMessage("Error occurred!");
    }

    setOtherSnackbarOpen(true);
  }

  const OtherSnackbar = (props) => {
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

  const menu = routes.map((route, index) => {
    return route.component ? (
      <Route
        key={index}
        path={route.path}
        exact={route.exact}
        name={route.name}
        render={(props) => <route.component {...props} />}
      />
    ) : null;
  });

  return (
    <Aux>
      <Row
        className="justify-content-md-center"
        style={{
          background: "white",
          margin: "0px 0px 20px 0px",
          boxShadow: "0px 2px 5px 2px #eee",
        }}
      >
        <Col xs={12} xl={9}>
          <Navbar bg="transparent" expand="lg">
            <Link to="/">
              <Navbar.Brand style={{ background: "transparent" }}>
                <img
                  alt=""
                  src={require("../../../assets/images/PCT-brand-logo.png")}
                  width="30"
                  height="30"
                  className="d-inline-block align-top"
                />
                Percent<span style={{ fontSize: "70%", margin: "0px 0px 0px 10px" }}>Beta</span>
              </Navbar.Brand>
            </Link>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav">
              <Nav className="mr-auto"></Nav>
              <Nav className="mr-true">
                <Nav.Link href="https://percent.finance">Rewards</Nav.Link>
                <Nav.Link href="https://twitter.com/PercentFinance">
                  Twitter
                </Nav.Link>
                <Nav.Link href="https://medium.com/percent-finance">
                  Medium
                </Nav.Link>
                <Nav.Link href="https://discord.gg/3sxWhH3">Discord</Nav.Link>
              </Nav>
              <Nav style={{ margin: "0px 40px 0px 0px" }}></Nav>
              <PctButton />
              <ConnectButton />
            </Navbar.Collapse>
          </Navbar>
        </Col>
      </Row>
      <Row
        className="justify-content-md-center"
        style={{ margin: "0px 3px 100px 3px" }}
      >
        <Col xs={12} xl={9}>
          {menu}
        </Col>
      </Row>
      <OtherSnackbar
        open={otherSnackbarOpen}
        message={otherSnackbarMessage}
        onClose={(event, reason) => {
          if (reason === "clickaway") {
            return;
          }
          setOtherSnackbarOpen(false);
        }}
      />
    </Aux>
  );
}

export default AdminLayout;
