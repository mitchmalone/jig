export function parseArgs(argv) {
	const args = { flavors: [], layers: [], git: true, verify: false, yes: false }
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (arg === '--name') args.name = argv[++i]
		else if (arg === '--dir') args.dir = argv[++i]
		else if (arg === '--flavors') args.flavors = argv[++i].split(',').filter(Boolean)
		else if (arg === '--layers') args.layers = argv[++i].split(',').filter(Boolean)
		else if (arg === '--author') args.author = argv[++i]
		else if (arg === '--template') args.template = argv[++i]
		else if (arg === '--agent') args.agent = argv[++i]
		else if (arg === '--no-git') args.git = false
		else if (arg === '--verify') args.verify = true
		else if (arg === '--yes' || arg === '-y') args.yes = true
		else if (arg === '--help' || arg === '-h') args.help = true
		else if (!arg.startsWith('-') && !args.name) args.name = arg
		else throw new Error(`unknown argument: ${arg}`)
	}
	return args
}
