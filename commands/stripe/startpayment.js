// dollars to cents
// const number = 20.49;
// 		const result = (parseFloat(number) * 100).toString();
// 		console.log(result);


const { SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_KEY);

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
		.setDescription('Starts a stripe payment'),
	async execute(interaction) {
		const name = interaction.options.getString('name');
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
		});
		await interaction.reply(paymentLink.url);
	},
};