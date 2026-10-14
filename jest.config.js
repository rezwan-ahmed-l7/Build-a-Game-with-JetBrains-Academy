export default {
    projects: [
        {
            displayName: "node-tests", // For Node.js tests
            testEnvironment: "node",
            testMatch: ["**/test/*.js"], // Match backend tests
            transform: { }, // An empty transform to skip Babel
            moduleNameMapper: {  // Tell Jest to map the #utils/* alias
                '^#utils/(.*)$': '<rootDir>/utils/$1',
            },
        },

        // You can skip this block if no React tests are needed in your course
        {
            displayName: "frontend-tests", // For React tests
            testEnvironment: "jsdom",
            // Be explicit about where frontend tests live to ensure discovery
            testMatch: [
                "**/test/*.jsx",
            ],
            extensionsToTreatAsEsm: [".jsx"],
            // Use Babel so Jest can parse JSX syntax if it appears in tests/imports
            // transform: {
            //     "^.+\\\.(jsx)$": ["babel-jest", { configFile: "./babel.config.cjs" }],
            // },
            moduleNameMapper: {
                // Ensure any import of 'three' resolves to a stable ESM mock for tests
                '^three$': '<rootDir>/__mocks__/three-esm.js',
                '^#utils/(.*)$': '<rootDir>/utils/$1',
            },
        },
    ],
};
