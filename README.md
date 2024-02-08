# CSGO Name Tag Tool

Rename items without the usual client-side limitations because I am seeing people buy items like this for stupid prices when they are just worth 1.99 USD.

## Why? How? What?

Just watch this video: https://www.youtube.com/watch?v=ekPZvM6v764

Its a random guy talking about it to ohnePixel, I thought it was dumb and nothing special so made this.

## Usage

1. Download [NodeJS](https://nodejs.org/) and install/update it (**Version 18.0.0 or higher**)
2. Download [Git](https://git-scm.com/) and install it
3. Open a command prompt and enter `git clone https://github.com/BeepIsla/csgo-nametag-tool.git --recursive`
4. Enter the just downloaded folder using `cd csgo-nametag-tool`
5. Download the required dependencies using `npm ci`
6. **Close CS and close Steam**
7. Run the program using `node index.js`
8. Follow the on-screen instructions
9. Start Steam/CS again and enjoy your new name tag
     - You can use the Steam inventory on your web browser to check if it worked without constantly starting and stopping Steam.

## Details

**Always test with a [Storage Unit](https://counterstrike.fandom.com/wiki/Storage_Unit) first, you can rename them for free infinitely! I am not responsible for any lost name tags or reduced item value.**

When you start the program you can choose two options:

- `Default Item`: Default stock items such as a default AK-47 (Requires a name tag)
- `Normal Item`: Any item you can see in your [Steam Inventory](https://steamcommunity.com/my/inventory/) (Requires a name tag unless its a [Storage Unit](https://counterstrike.fandom.com/wiki/Storage_Unit))
  - When entering the Steam inventory link for the item you want to rename go to [your Steam inventory]([https://steam](https://steamcommunity.com/my/inventory/)), find the item you want to rename, then right click -> Copy link address. You should now have a link similar to this: `/inventory/#730_2_4287161377`

If you wish to rename your items with special characters I recommend you use the `File` input method. When using the `File` input method a new file will be created called `new_name.txt`, open it in a text editor and write what you want. When you are done save it and press Enter in the console.

Note: When using the `File` input method some things are automatically removed or replaced. The `\r` character gets entirely deleted. All `\n` (New line characters) get replaced with whatever this means `E2 80 A9` but it has the same effect as `\n`.

For example entering this:

```









₿ ⛏









```

Results in this:

![](https://i.imgur.com/FV4ylYa.png)

![](https://i.imgur.com/lzMRXLF.png)
