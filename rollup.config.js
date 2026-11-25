import { nodeResolve } from "@rollup/plugin-node-resolve";
export default {input:"src/index.js",output:{file:"delayed-action-card.js",format:"es"},plugins:[nodeResolve({browser:true})]};
