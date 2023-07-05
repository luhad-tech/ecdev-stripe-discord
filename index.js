const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_KEY);
const endpointSecret = process.env.STRIPE_SECRET;
const express = require('express');
const app = express();

const redis = require('redis');
const rClient = redis.createClient({
	socket: {
		host: 'redis',
	},
});

rClient.on('error', err => console.log('Redis Server Error', err));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		}
		else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	}
	else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

client.login(process.env.D_TOKEN);

// Stripe webhook

app.post('/webhook', express.raw({ type: 'application/json' }), async (request, response) => {
	let sEvent = request.body;
	// Only verify the event if you have an endpoint secret defined.
	// Otherwise use the basic event deserialized with JSON.parse
	if (endpointSecret) {
	// Get the signature sent by Stripe
		const signature = request.headers['stripe-signature'];
		try {
			sEvent = stripe.webhooks.constructEvent(
				request.body,
				signature,
				endpointSecret,
			);
		}
		catch (err) {
			console.log('⚠️  Webhook signature verification failed.', err.message);
			return response.sendStatus(400);
		}
	}
	// Handle the event
	let pLinkData;
	switch (sEvent.type) {
	case 'payment_intent.succeeded':
		console.log(`PaymentIntent for ${sEvent.data.object.amount} was successful!`);
		// Then define and call a method to handle the successful payment intent.
		// handlePaymentIntentSucceeded(paymentIntent);
		break;
	case 'payment_method.attached':
		// const paymentMethod = event.data.object;
		// Then define and call a method to handle the successful attachment of a PaymentMethod.
		// handlePaymentMethodAttached(paymentMethod);
		break;
	case 'checkout.session.completed':
		rClient.connect();
		pLinkData = await rClient.get(sEvent.data.object.payment_link);
		pLinkData = JSON.parse(pLinkData);
		rClient.disconnect();
		console.log('User ID ' + pLinkData.user);
		console.log('Channel ID ' + pLinkData.channel);
		client.channels.fetch(pLinkData.channel)
			.then(c => c.send(`You purchase is complete <@${pLinkData.user}>! Thank you!`))
			.catch(console.error);
		break;
	default:
		// Unexpected event type
		console.log(`Unhandled event type ${sEvent.type}.`);
	}

	// Return a 200 response to acknowledge receipt of the event
	response.send();
});

app.listen(9925, () => console.log('Running on port 9925'));