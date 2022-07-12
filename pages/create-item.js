import  { useState } from "react";
import { ethers } from 'ethers';
import { create as ipfsHttpClient } from "ipfs-http-client";
import { useRouter } from "next/router";
import Web3Modal from "web3modal";
import {nftaddress, nftmarketaddress} from "../config";

const client = ipfsHttpClient("https://ipfs.infura.io:5001/api/v0")

import NFT from '../artifacts/contracts/NFT.sol/NFT.json'
import Market from '../artifacts/contracts/NFTMarket.sol/NFTMarket.json'

export default function CreateItem() {
    const [fileUrl, setFileUrl] = useState(null);
    const [formInput, updateFormInput] = useState({price: '', name: '', description: ''});

    const router = useRouter();

    async function onChange(e) {
        // Here we are uploading the files.
        const file = e.target.files[0];

        try {
            const added = await client.add(
                file, {
                    progress: (prog) => console.log(`recieved: ${prog}`),
                }
            )
            // Here we have created and uploaded the file to ipfs.
            const url = `https://ipfs.infura.io/ipfs/${added.path}`;
            console.log("Image URL : "+url);
            setFileUrl(url);
        } catch (e) {
            console.log(e)
        }
    }

    async function createItem() {
        // In this function we are handling the meta data of the nft
        const {name, description, price} = formInput;
        if(!name || !description || !price || !fileUrl){
            return;
        }
        const data = JSON.stringify({
            name,description,image:fileUrl
        });

        try{
            // Here are have modified the data into json form to store it in the meta of ipfs
            const added = await client.add(data);
            const url = `https://ipfs.infura.io/ipfs/${added.path}`;
            console.log("Data URL : "+url);
            // After file is uploaded to IPFS, pass the URL to save it on Polygon
            createSale(url);
        }catch (e){
            console.log(e);
        }
    }

    async function createSale(url){
        // Here we have connect to app to any wallet.
        const web3Modal = new Web3Modal();
        const connection = await web3Modal.connect();
        const provider = new ethers.providers.Web3Provider(connection);
        const signer = provider.getSigner();

        let contract = new ethers.Contract(nftaddress, NFT.abi ,signer);
        let transaction = await contract.createToken(url);
        let tx = await transaction.wait();

        let event = tx.events[0];
        let value = event.args[2];
        let tokenId = value.toNumber();

        const price = ethers.utils.parseUnits(formInput.price , 'ether');

        contract = new ethers.Contract(nftmarketaddress, Market.abi, signer);
        let listingPrice = await contract.getListingPrice();
        listingPrice = listingPrice.toString();

        transaction = await contract.createMarketItem(nftaddress , tokenId, price , {value: listingPrice});

        await transaction.wait();
        router.push('/');
    }

    return (
        <div className="flex justify-center">
            <div className="w-1/2 flex flex-col pb-12">
                 <input placeholder="Asset Name"
                        className="mt-8 border rounded p-4"
                        onChange={e => updateFormInput({...formInput, name: e.target.value})}/>
                <textarea placeholder="Asset Description"
                          className="mt-2 border rounded p-4"
                          onChange={e => updateFormInput({...formInput, description: e.target.value})}/>
                <input placeholder="Asset Price in Matic"
                          className="mt-2 border rounded p-4"
                          onChange={e => updateFormInput({...formInput, price: e.target.value})}/>

                <input type="file" name="Asset" className="my-4" onChange={onChange}/>

                {
                    fileUrl && (
                        <img className="rounded mt-4" width="350" src={fileUrl} />
                    )
                }

                <button onClick={createItem}
                        className="font-bold mt-4 bg-blue-800 text-white rounded p-4 shadow-lg">
                    Create Digital Asset</button>
            </div>
        </div>
    )
}