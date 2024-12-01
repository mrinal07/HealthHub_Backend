// MongoDB Schema for Car


const LoginStatus ={
    Active: 1,
    InActive: 2,
    Locked: 3,
    Deleted: 4
}
//#region User Schema
const userSchema = new mongoose.Schema({
    Username: String,
    Password: String,
    Email: String,
    Login_Token: String,
    Login_Status: Number,

    Status_Enum: Boolean,
    Lock_Id: Number,
    Last_Modify_Date: Date,    
});



//#endregion


//#region Documnent Schema
const documentSchema = new mongoose.Schema({
    User_Id: String,
    Document_Name: String,
    Document_Type: String,
    Document_File_Path: String,
    Document_Upload_Date: Date,
    Document_Expire_Date: Date,

    Status_Enum: Boolean,
    Lock_Id: Number,
    Last_Modify_Date: Date,    

    
});


//#endregion


//#region result, year, month JSON structure
resul =[
    {
        "year": 2021,
        "month": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],        
        "month": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    },
    {
        "year": 2022,
        "month": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],        
    }
]
