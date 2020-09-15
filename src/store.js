import React, { createContext, useReducer } from "react";

const initialState = {
  provider: null,
};
const store = createContext(initialState);
const { Provider } = store;

const StateProvider = ({ children }) => {
  const [state, dispatch] = useReducer((state, action) => {
    switch (action.type) {
      case "UPDATE_PROVIDER":
        return Object.assign({}, state, {
          provider: action.provider,
        });
      default:
        throw new Error("Unknown action type");
    }
  }, initialState);

  return <Provider value={{ state, dispatch }}>{children}</Provider>;
};

export { store, StateProvider };
