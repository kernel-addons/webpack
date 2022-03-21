export default {
    get Dispatcher() {return Webpack.getByProps("dirtyDispatch");},
    get Constants() {return Webpack.getByProps("API_HOST", "ActionTypes");},
    get Flux() {return Object.assign({}, ...Webpack.getByProps(["connectStores"], ["useStateFromStores"], ["Store", "Dispatcher"], {bulk: true}));},
    get React() {return Webpack.getByProps("createElement", "useEffect");},
    get ReactDOM() {return Webpack.getByProps("render", "unmountComponentAtNode");}
}