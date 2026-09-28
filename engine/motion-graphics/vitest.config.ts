import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',testTimeout:600000,hookTimeout:180000,fileParallelism:false}});
