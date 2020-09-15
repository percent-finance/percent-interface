import React, { Component, useContext, useEffect, useState } from "react";
import { Route, Link } from "react-router-dom";

import routes from "../../../routes";
import Aux from "../../../hoc/_Aux";
import { Row, Col, Navbar, Nav, Button, Dropdown } from "react-bootstrap";
import { store } from "../../../store";

import "./app.scss";

import { injected } from "../../../connectors";
import { useEagerConnect, useInactiveListener } from "../../../hooks";
import { useWeb3React } from "@web3-react/core";

function AdminLayout() {
  const { state, dispatch } = useContext(store);

  const triedEager = useEagerConnect();

  useInactiveListener(!triedEager);

  function ConnectButton() {
    const { chainId, account, activate, deactivate, active } = useWeb3React();

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
        <Col xs={12} lg={8}>
          <Navbar bg="transparent" expand="lg">
            <Link to="/">
              <Navbar.Brand style={{ background: "transparent" }}>
                <img
                  alt=""
                  src={require("../../../assets/images/PCT-logo.png")}
                  width="30"
                  height="30"
                  className="d-inline-block align-top"
                />
                Percent
              </Navbar.Brand>
            </Link>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav">
              <Nav className="mr-auto"></Nav>
              <Nav className="mr-true">
                <Nav.Link href="https://rewards.percent.finance">
                  Rewards
                </Nav.Link>
                <Nav.Link href="https://twitter.com/PercentFinance">
                  Twitter
                </Nav.Link>
                <Nav.Link href="https://medium.com/percent-finance">
                  Medium
                </Nav.Link>
                <Nav.Link href="https://discord.com/">Discord</Nav.Link>
              </Nav>
              <ConnectButton />
            </Navbar.Collapse>
          </Navbar>
        </Col>
      </Row>
      <Row
        className="justify-content-md-center"
        style={{ margin: "0px 3px 100px 3px" }}
      >
        <Col xs={12} lg={8}>
          {menu}
        </Col>
      </Row>
    </Aux>
  );
}

export default AdminLayout;
