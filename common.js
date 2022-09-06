export default {
    get Dispatcher() {return Webpack.getByProps("dispatch", "isDispatching");},
    get Constants() {return Webpack.getByProps("API_HOST", "Endpoints");},
    get Flux() {return Object.assign({}, ...Webpack.getByProps(["connectStores"], ["useStateFromStores"], ["Store", "Dispatcher"], {bulk: true}));},
    get React() {return Webpack.getByProps("createElement", "useEffect");},
    get ReactDOM() {return Webpack.getByProps("render", "unmountComponentAtNode");}
}
