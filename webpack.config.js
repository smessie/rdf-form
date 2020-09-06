const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { SourceMapDevToolPlugin } = require('webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const isDevelopment = process.env.NODE_ENV === 'development'

let htmlPageNames = ['profile', 'vcard']
let multipleHtmlPlugins = htmlPageNames.map(name => {
  return new HtmlWebpackPlugin({
    template: `./src/${name}.html`,
    filename: `${name}.html`,
  })
})

module.exports = {
  entry: './src/RdfForm.ts',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.scss']
  },
  devtool: false,
  output: {
    path: path.join(__dirname, '/dist'),
    filename: 'bundle.min.js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'awesome-typescript-loader'
      },
      {
        test: /\.module\.s(a|c)ss$/,
        loader: [
          isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: true,
              sourceMap: isDevelopment
            }
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: isDevelopment
            }
          }
        ]
      },
      {
        test: /\.s(a|c)ss$/,
        exclude: /\.module.(s(a|c)ss)$/,
        loader: [
          isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
          'css-loader',
          {
            loader: 'sass-loader',
            options: {
              sourceMap: isDevelopment
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'node_modules/svg-country-flags/svg',
          to: './flags'
        },
        {
          from: 'public',
          to: '.'
        },

      ],
    }),
    new MiniCssExtractPlugin({
      filename: isDevelopment ? '[name].css' : '[name].[hash].css',
      chunkFilename: isDevelopment ? '[id].css' : '[id].[hash].css'
    }),
    new SourceMapDevToolPlugin({
      filename: '[file].map'
    }),
    new HtmlWebpackPlugin({
      template: './src/index.html',
      chunks: ['main']
    })
  ].concat(multipleHtmlPlugins)
}
