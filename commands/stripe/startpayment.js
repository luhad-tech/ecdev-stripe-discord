// dollars to cents
// const number = 20.49;
// 		const result = (parseFloat(number) * 100).toString();
// 		console.log(result);


const { SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_KEY);
const redis = require('redis');
const rClient = redis.createClient({
	socket: {
		host: 'redis',
	},
});

rClient.on('error', err => console.log('Redis Server Error', err));

module.exports = {
	data: new SlashCommandBuilder()
		.setName('startpayment')
		.addStringOption(option =>
			option
				.setName('name')
				.setDescription('Product name')
				.setRequired(true))
		.addIntegerOption(option =>
			option
				.setName('price')
				.setDescription('Product price')
				.setRequired(true))
		.addUserOption(option =>
			option
				.setName('user')
				.setDescription('User that is making the payment')
				.setRequired(true))
		.setDescription('Starts a stripe payment'),
	async execute(interaction) {
		const name = interaction.options.getString('name');
		const user = interaction.options.getMember('user');
		const channelId = interaction.channelId;
		const numToCents = interaction.options.getInteger('price');
		const product = await stripe.products.create({
			name: name,
		});
		const price = await stripe.prices.create({
			unit_amount: (parseFloat(numToCents) * 100).toString(),
			currency: 'usd',
			product: product.id,
		});
		const paymentLink = await stripe.paymentLinks.create({
			line_items: [
				{
					price: price.id,
					quantity: 1,
				},
			],
			custom_fields: [
				{
					key: 'discord',
					label: {
						type: 'custom',
						custom: 'Discord Username',
					},
					type: 'text',
				},
			],
		});
		const data = {
			'user': user.id,
			'channel': channelId,
		};
		const payLinkEm = {
			title: '[your company here] Payments',
			description: `${user}, here is your payment link. DO NOT SHARE THIS LINK!\n${paymentLink.url}`,
			color: 6779621,
			thumbnail: {
				url: 'https://www.nicepng.com/png/full/870-8701139_your-logo-here-png-gloucester-road-tube-station.png',
			},
		};
		await rClient.connect();
		await rClient.set(paymentLink.id, JSON.stringify(data));
		await rClient.disconnect();
		// `${user}, here is your payment link. DO NOT SHARE THIS LINK!\n${paymentLink.url}`
		await interaction.reply({ embeds: [payLinkEm] });
	},
};