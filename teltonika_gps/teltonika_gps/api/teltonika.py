import socket
import json
import os
import datetime
import struct
import decimal
import frappe
import time


HOST = '0.0.0.0'  #function may not work in Linux systems, change to string with IP adress example: "192.168.0.1"
PORT = 8083  #change this to your port

def input_trigger(): #triggers user input         
        
    # print("Paste full 'Codec 8' packet to parse it or:")
    # print("Type SERVER to start the server or:")
    # print("Type EXIT to stop the program")
    device_imei = "default_IMEI"
    start_server_trigger()   

####################################################
###############_CRC16/ARC Checker_################
####################################################

def crc16_arc(data):    
    data_part_length_crc = int(data[8:16], 16)
    data_part_for_crc = bytes.fromhex(data[16:16+2*data_part_length_crc])
    crc16_arc_from_record = data[16+len(data_part_for_crc.hex()):24+len(data_part_for_crc.hex())]  
    
    crc = 0
    
    for byte in data_part_for_crc:
        crc ^= byte
        for _ in range(8):
            if crc & 1:
                crc = (crc >> 1) ^ 0xA001
            else:
                crc >>= 1
    
    if crc16_arc_from_record.upper() == crc.to_bytes(4, byteorder='big').hex().upper():
        print ("CRC check passed!")
        print (f"Record length: {len(data)} characters // {int(len(data)/2)} bytes")
        return True
    else:
        print("CRC check Failed!")
        return False

####################################################

def codec_8e_checker(codec8_packet):
    if str(codec8_packet[16:16+2]).upper() != "8E" and str(codec8_packet[16:16+2]).upper() != "08": 
        print() 
        print(f"Invalid packet!!!!!!!!!!!!!!!!!!!")     
        return False
    else:
        return crc16_arc(codec8_packet)

def codec_parser_trigger(codec8_packet, device_imei, props):
        try:            
            return codec_8e_parser(codec8_packet.replace(" ",""), device_imei, props)

        except Exception as e:
            print(f"Error occured: {e} enter proper Codec8 packet or EXIT!!!")
            input_trigger()

def imei_checker(hex_imei): #IMEI checker function
    imei_length = int(hex_imei[:4], 16)
#   print(f"IMEI length = {imei_length}")
    if imei_length != len(hex_imei[4:]) / 2:
#       print(f"Not an IMEI - length is not correct!")
        return False
    else:
        pass

    ascii_imei = ascii_imei_converter(hex_imei)
    print(f"IMEI received = {ascii_imei}")
    if not ascii_imei.isnumeric() or len(ascii_imei) != 15:
        print(f"Not an IMEI - is not numeric or wrong length!")
        return False
    else:
        return True

def ascii_imei_converter(hex_imei):
    return bytes.fromhex(hex_imei[4:]).decode()

def start_server_trigger():
    print("Starting server!")
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((HOST, PORT))
        while True:
            s.listen()
            conn, addr = s.accept()
            conn.settimeout(20)  # Connection timeout
            with conn:
                device_imei = "default_IMEI"
                while True:
                    try:
                        data = conn.recv(3000)
                        if not data:
                            break
                        elif imei_checker(data.hex()) != False:
                            device_imei = ascii_imei_converter(data.hex())
                            imei_reply = (1).to_bytes(1, byteorder="big")
                            conn.sendall(imei_reply)
                        elif codec_8e_checker(data.hex().replace(" ","")) != False:
                            record_number = codec_parser_trigger(data.hex(), device_imei, "SERVER")
                            record_response = (record_number).to_bytes(4, byteorder="big")
                            conn.sendall(record_response)
                            break
                        else:
                            print(f"// {time_stamper()} // no expected DATA received - dropping connection")
                            break
                    except socket.timeout:
                        print(f"// {time_stamper()} // Socket timed out. Closing connection with {addr}")
                        break
                    finally:
                        conn.close()
                        frappe.db.commit()
                        frappe.destroy()
                            
####################################################
###############Codec8E_parser_code################
####################################################


def codec_8e_parser(codec_8E_packet, device_imei, props):
    records = []  # List to store all records
    
    io_dict_raw = {}
    io_dict_raw["device_IMEI"] = device_imei
    io_dict_raw["server_time"] = time_stamper_for_json()
    io_dict_raw["data_length"] = "Record length: " + str(int(len(codec_8E_packet))) + " characters" + " // " + str(int(len(codec_8E_packet) // 2)) + " bytes"
    io_dict_raw["raw_data_"] = codec_8E_packet

    zero_bytes = codec_8E_packet[:8]
    # print(f"zero bytes = {zero_bytes}")

    data_field_length = int(codec_8E_packet[8:8+8], 16)
    # print(f"data field length = {data_field_length} bytes")
    codec_type = str(codec_8E_packet[16:16+2])
    # print(f"codec type = {codec_type}")

    data_step = 4 if codec_type != "08" else 2

    number_of_records = int(codec_8E_packet[18:18+2], 16)
    # print(f"number of records = {number_of_records}")

    avl_data_start = codec_8E_packet[20:]
    data_field_position = 0

    while data_field_position < (2*data_field_length - 6):                
        io_dict = {}
        io_dict["device_IMEI"] = device_imei        
        io_dict["server_time"] = time_stamper_for_json()
        
        timestamp = avl_data_start[data_field_position:data_field_position+16]
        io_dict["timestamp"] = device_time_stamper(timestamp)     
        data_field_position += len(timestamp)

        priority = avl_data_start[data_field_position:data_field_position+2]
        io_dict["priority"] = int(priority, 16)
        data_field_position += len(priority)

        longitude = avl_data_start[data_field_position:data_field_position+8]
        io_dict["longitude"] = coordinate_formater(longitude)
        data_field_position += len(longitude)

        latitude = avl_data_start[data_field_position:data_field_position+8]
        io_dict["latitude"] = coordinate_formater(latitude)
        data_field_position += len(latitude)

        altitude = avl_data_start[data_field_position:data_field_position+4]
        io_dict["altitude"] = int(altitude, 16)
        data_field_position += len(altitude)

        angle = avl_data_start[data_field_position:data_field_position+4]
        io_dict["angle"] = int(angle, 16)
        data_field_position += len(angle)

        satelites = avl_data_start[data_field_position:data_field_position+2]
        io_dict["satelites"] = int(satelites, 16)
        data_field_position += len(satelites)

        speed = avl_data_start[data_field_position:data_field_position+4]
        io_dict["speed"] = int(speed, 16)
        data_field_position += len(speed)

        event_io_id = avl_data_start[data_field_position:data_field_position+data_step]
        io_dict["eventID"] = int(event_io_id, 16)       
        data_field_position += len(event_io_id)

        total_io_elements = avl_data_start[data_field_position:data_field_position+data_step]
        total_io_elements_parsed = int(total_io_elements, 16)
        data_field_position += len(total_io_elements)

        byte1_io_number = avl_data_start[data_field_position:data_field_position+data_step]
        byte1_io_number_parsed = int(byte1_io_number, 16)
        data_field_position += len(byte1_io_number)     

        # Process 1-byte I/O elements
        for i in range(byte1_io_number_parsed):
            key = avl_data_start[data_field_position:data_field_position+data_step]
            data_field_position += len(key)
            value = avl_data_start[data_field_position:data_field_position+2]
            io_dict[int(key, 16)] = sorting_hat(int(key, 16), value)
            data_field_position += len(value)

        byte2_io_number = avl_data_start[data_field_position:data_field_position+data_step]
        byte2_io_number_parsed = int(byte2_io_number, 16)
        data_field_position += len(byte2_io_number)

        # Process 2-byte I/O elements
        for i in range(byte2_io_number_parsed):
            key = avl_data_start[data_field_position:data_field_position+data_step]
            data_field_position += len(key)
            value = avl_data_start[data_field_position:data_field_position+4]
            io_dict[int(key, 16)] = sorting_hat(int(key, 16), value)
            data_field_position += len(value)

        byte4_io_number = avl_data_start[data_field_position:data_field_position+data_step]
        byte4_io_number_parsed = int(byte4_io_number, 16)
        data_field_position += len(byte4_io_number)

        # Process 4-byte I/O elements
        for i in range(byte4_io_number_parsed):
            key = avl_data_start[data_field_position:data_field_position+data_step]
            data_field_position += len(key)
            value = avl_data_start[data_field_position:data_field_position+8]
            io_dict[int(key, 16)] = sorting_hat(int(key, 16), value)
            data_field_position += len(value)

        byte8_io_number = avl_data_start[data_field_position:data_field_position+data_step]
        byte8_io_number_parsed = int(byte8_io_number, 16)
        data_field_position += len(byte8_io_number)

        # Process 8-byte I/O elements
        for i in range(byte8_io_number_parsed):
            key = avl_data_start[data_field_position:data_field_position+data_step]
            data_field_position += len(key)
            value = avl_data_start[data_field_position:data_field_position+16]
            io_dict[int(key, 16)] = sorting_hat(int(key, 16), value)
            data_field_position += len(value)

        # Process X-byte I/O elements if codec_type is 8E
        if codec_type.upper() == "8E":
            byteX_io_number = avl_data_start[data_field_position:data_field_position+4]
            byteX_io_number_parsed = int(byteX_io_number, 16)
            data_field_position += len(byteX_io_number)

            for i in range(byteX_io_number_parsed):
                key = avl_data_start[data_field_position:data_field_position+4]
                data_field_position += len(key)
                value_length = avl_data_start[data_field_position:data_field_position+4]
                data_field_position += 4
                value = avl_data_start[data_field_position:data_field_position+(2*(int(value_length, 16)))]
                io_dict[int(key, 16)] = sorting_hat(int(key, 16), value)        
                data_field_position += len(value)

        records.append(io_dict)  # Append the record to the list

    # Find the record with the most recent timestamp
    if records:
        latest_record = max(records, key=lambda r: datetime.datetime.strptime(extract_timestamp(r["timestamp"]), "%H:%M:%S %d-%m-%Y"))
        print("\nMost Recent Record Details:")
        for key, value in latest_record.items():
            print(f"{key}: {value}")

        if latest_record:
            try:
                imei_no = frappe.get_doc('Vehicle', {'custom_imei_number': latest_record['device_IMEI']})
                gps_log = frappe.get_doc({
                    'doctype': 'GPS Log',
                    'device_id': latest_record['device_IMEI'],
                    'longitude': latest_record['longitude'],
                    'latitude': latest_record['latitude'],
                    'received_at': latest_record['timestamp'],
                    'altitude': latest_record['altitude'],
                    'custom_angle': latest_record['angle'],
                    'custom_satellites': latest_record['satelites'],
                    'speed': latest_record['speed'],
                    'vehicle': imei_no.license_plate  # Convert the dictionary to a JSON string
                })
                gps_log.insert(ignore_permissions=True)
                frappe.db.commit()
                print(f"GPS log inserted successfully for IMEI: {latest_record['device_IMEI']}")
                # print(f"Inserted record: {latest_record}")
            except Exception as e:
                print(f"Error inserting GPS log: {e}")

    if props == "SERVER":   
        total_records_parsed = int(avl_data_start[data_field_position:data_field_position+2], 16)
        print()
        print(f"total parsed records = {total_records_parsed}")
        print()
        return int(number_of_records)
    else:
        total_records_parsed = int(avl_data_start[data_field_position:data_field_position+2], 16)
        print()
        print(f"total parsed records = {total_records_parsed}")
        print()
        return int(number_of_records)

def extract_timestamp(raw_timestamp):
    # Extracting the date and time portion before "(local)" and "(utc)"
    timestamp_part = raw_timestamp.split(" ")[0] + " " + raw_timestamp.split(" ")[1]
    return timestamp_part
####################################################
###############_End_of_MAIN_Parser_Code#############
####################################################

####################################################
###############Coordinates_Function###############
####################################################

def coordinate_formater(hex_coordinate): # Fixed :), hopefuly this works for you too - https://stackoverflow.com/questions/36506910/convert-integer-to-lat-long-geo-position
        coordinate = int(hex_coordinate, 16)
        if coordinate & (1 << 31):
            new_int = coordinate - 2**32
            dec_coordinate = new_int/1e7
        else:
            dec_coordinate = coordinate / 10000000
        return dec_coordinate




####################################################
###############_TIME_FUNCTIONS_###############
####################################################

def time_stamper():
    current_server_time = datetime.datetime.now()   
    server_time_stamp = current_server_time.strftime('%H:%M:%S %d-%m-%Y')
    return server_time_stamp

def time_stamper_for_json():
    current_server_time = datetime.datetime.now()
    timestamp_utc = datetime.datetime.utcnow()
    server_time_stamp = f"{current_server_time.strftime('%H:%M:%S %d-%m-%Y')} (local) / {timestamp_utc.strftime('%H:%M:%S %d-%m-%Y')} (utc)"
    return server_time_stamp

def device_time_stamper(timestamp):
    timestamp_ms = int(timestamp, 16) / 1000
    timestamp_utc = datetime.datetime.utcfromtimestamp(timestamp_ms)
    utc_offset = datetime.datetime.fromtimestamp(timestamp_ms) - datetime.datetime.utcfromtimestamp(timestamp_ms)
    timestamp_local = timestamp_utc + utc_offset
    formatted_timestamp_local = timestamp_local.strftime("%H:%M:%S %d-%m-%Y")
    formatted_timestamp_utc = timestamp_utc.strftime("%H:%M:%S %d-%m-%Y")
    formatted_timestamp = f"{formatted_timestamp_local} (local) / {formatted_timestamp_utc} (utc)"

    return formatted_timestamp

def record_delay_counter(timestamp):
    timestamp_ms = int(timestamp, 16) / 1000
    current_server_time = datetime.datetime.now().timestamp()
    return f"{int(current_server_time - timestamp_ms)} seconds"

####################################################
###############PARSE_FUNCTIONS_CODE###############
####################################################

def parse_data_integer(data):
    return int(data, 16)

def int_multiply_01(data):
    return float(decimal.Decimal(int(data, 16)) * decimal.Decimal('0.1'))

def int_multiply_001(data):
    return float(decimal.Decimal(int(data, 16)) * decimal.Decimal('0.01')) 

def int_multiply_0001(data):
    return float(decimal.Decimal(int(data, 16)) * decimal.Decimal('0.001'))

def signed_no_multiply(data): #need more testing of this function
    try:
        binary = bytes.fromhex(data.zfill(8))
        value = struct.unpack(">i", binary)[0]
        return value
    except Exception as e:
        print(f"unexpected value received in function '{data}' error: '{e}' will leave unparsed value!")
        return f"0x{data}"

parse_functions_dictionary = { #this must simply be updated with new AVL IDs and their functions
    
    240: parse_data_integer,
    239: parse_data_integer,
    80: parse_data_integer,
    21: parse_data_integer,
    200: parse_data_integer,
    69: parse_data_integer,
    181: int_multiply_01,
    182: int_multiply_01,
    66: int_multiply_0001,
    24: parse_data_integer,
    205: parse_data_integer,
    206: parse_data_integer,
    67: int_multiply_0001,
    68: int_multiply_0001,
    241: parse_data_integer,
    299: parse_data_integer,
    16: parse_data_integer,
    1: parse_data_integer,
    9: parse_data_integer,
    179: parse_data_integer,
    12: int_multiply_0001,
    13: int_multiply_001,
    17: signed_no_multiply,
    18: signed_no_multiply,
    19: signed_no_multiply,
    11: parse_data_integer,
    10: parse_data_integer,
    2: parse_data_integer,
    3: parse_data_integer,
    6: int_multiply_0001,
    180: parse_data_integer

}

def sorting_hat(key, value):
    if key in parse_functions_dictionary:
        parse_function = parse_functions_dictionary[key]
        return parse_function(value)
    else:
        return f"0x{value}"

####################################################

def fileAccessTest(): #check if script can create files and folders
    try: 
        testDict = {}
        testDict["Writing_Test"] = "Writing_Test"
        testDict["Script_Started"] = time_stamper_for_json()

        # json_printer(testDict, "file_Write_Test")

        print (f"---### File access test passed! ###---")
        print("Waiting for 30 seconds before requesting the server...")
        time.sleep(30)
        input_trigger()

    except Exception as e:
        print ()
        print (f"---### File access error occured ###---")
        print (f"'{e}'")
        print ()
        input_trigger()


def main():
    fileAccessTest()

def run_tcp_server():
    main()