# CSGO Name Tag Tool

Rename items without the usual client-side limitations because I am seeing people buy items like this for stupid prices when they are just worth 1.99 USD.

## Why? How? What?

Just watch this video: https://www.youtube.com/watch?v=ekPZvM6v764

## Usage

1. Download [NodeJS](https://nodejs.org/) and install/update it
2. Download [Git](https://git-scm.com/) and install it
3. Open a command prompt and enter `git clone https://github.com/BeepIsla/csgo-nametag-tool.git --recursive`
4. Enter the just downloaded folder using `cd csgo-nametag-tool`
5. Download the required dependencies using `npm ci`
6. Run the program using `node index.js`
7. Follow the on-screen instructions

## Details

**Always test with a [Storage Unit](https://counterstrike.fandom.com/wiki/Storage_Unit) first, you can rename them for free infinitely! I am not responsible for any lost name tags or reduced item value.**

When you start the program you can choose two options:

- `Default Item`: Default stock items such as a default AK-47 (Requires a name tag)
- `Normal Item`: Any item you can see in your [Steam Inventory](https://steamcommunity.com/my/inventory/) (Requires a name tag unless its a [Storage Unit](https://counterstrike.fandom.com/wiki/Storage_Unit))
  - When entering the Steam inventory link for the item you want to rename go to [your Steam inventory]([https://steam](https://steamcommunity.com/my/inventory/)), find the item you want to rename, then right click -> Copy link address. You should now have a link similar to this: `/inventory/#730_2_4287161377`

The CSGO backend might still restrict some input, for example newline characters get turned into space characters automatically and there is a hard limit for the amount of characters you can use: Always test with a [Storage Unit](https://counterstrike.fandom.com/wiki/Storage_Unit) first.

If you wish to rename your items with special characters I recommend you use the raw hex system. Simply convert [any text you want](https://www.rapidtables.com/convert/number/ascii-to-hex.html) into hexadecimal and prefix it with `0x`.

For example entering this:

```
0xE280A9E280A9E280A9E280A9E280A9E280A9E280A9E280A9E280A9E282BF20E29B8FE280A9E280A9E280A9E280A9E280A9E280A9E280A9E280A9E280A9
```

Results in [this](https://i.imgur.com/A7Hs67c.png):

![](https://i.imgur.com/A7Hs67c.png)
