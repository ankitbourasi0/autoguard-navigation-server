//1.import express
const { default: axios } = require('axios');
//9import axios for get data from other endpoint
const express = require('express')
//2.create express instance with express function
const app = express()
//3.assign a server port
const port  =  3000;
//7. add a middleware, so that express will handle data is comming in JSON body
app.use(express.json());
//4. Create a health check method to test api
app.get("/health",(req, res)=>{
    res.status(200).json({status:"ok",message:"server is running"})
})
//8.
app.post("/current-location",(req,res)=>{
    const {longitude, latitude} =req.body

    //validation 
    if(!longitude || !latitude){
        res.status(403).json({status:"Bad Request", message:"All fields are required"})
    }



   if(typeof longitude === "number" || typeof latitude === "number"){
    return res.status(200).json({
        status:"success",
        message:"Location recieved successfully",
        data:{
            longitude,
            latitude
        },
    });   
}else{
    res.status(400).json({"status":"error", message:"Longitude and Latitude must be of type number"})
}
}
);

//10.
app.post('/location', async (req, res) => {
    const { latitude, longitude } = req.body;
  
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ status: 'error', message: 'Invalid coordinates' });
    }
  
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          format: 'json',
          lat: latitude,
          lon: longitude
        },
        headers: {
          'User-Agent': 'MyExpressApp/1.0 (ankitbourasi0@gmail.com)' // Must include this
        }
      });
  
      const address = response.data.display_name || 'Address not found';
  
      res.status(200).json({
        status: 'success',
        coordinates: { latitude, longitude },
        address: address
      });
    } catch (err) {
      console.error('Reverse geocoding failed:', err.message);
      res.status(500).json({ status: 'error', message: 'Failed to fetch address' });
    }
  });
  

//5. listen the server 
app.listen(port,()=>{
    console.log(`Server is running at port ${port}`)
})

//6. test the endpoint at http://localhost:3000/health