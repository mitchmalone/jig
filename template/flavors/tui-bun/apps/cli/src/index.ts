import { greeting } from './greeting'

// Version is stamped from the release tag at build time; 0.0.0 in dev.
console.warn(greeting('__PROJECT_NAME__'))
